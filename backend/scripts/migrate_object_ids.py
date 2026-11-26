"""Convert legacy MongoDB IDs. Run from backend with python -m scripts.migrate_object_ids."""

import argparse
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from bson import ObjectId
from pymongo import DeleteOne, InsertOne, UpdateOne
from pymongo.client_session import ClientSession
from pymongo.database import Database
from pymongo.errors import PyMongoError
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern


# Chỉ chuyển các trường ID của MongoDB. Khóa Chroma và nội dung nguồn trích dẫn có cấu trúc riêng.
REFERENCES = {
    "knowledge_bases": {},
    "conversations": {},
    "messages": {"conversation_id": "conversations"},
    "fs.files": {"metadata.knowledge_base_id": "knowledge_bases"},
    "fs.chunks": {"files_id": "fs.files"},
    "document_chunks": {"document_id": "fs.files", "knowledge_base_id": "knowledge_bases"},
}
BATCH_SIZE = 200


class MigrationBlocked(Exception):
    pass


@dataclass(frozen=True)
class Change:
    original_id: Any
    updates: dict[str, ObjectId]


@dataclass
class MigrationPlan:
    changes: dict[str, list[Change]]
    issues: Counter[str]

    @property
    def record_count(self) -> int:
        return sum(len(changes) for changes in self.changes.values())


def read_path(document: Mapping[str, Any], path: str) -> Any:
    value = document
    for key in path.split("."):
        if not isinstance(value, Mapping):
            return None
        value = value.get(key)
    return value


# Lập danh sách thay đổi và dò trùng ID hoặc thiếu bản ghi đích trước khi ghi.
def plan_migration(database: Database, session: ClientSession | None = None) -> MigrationPlan:
    changes = {name: [] for name in REFERENCES}
    issues: Counter[str] = Counter()
    primary = {name: set() for name in REFERENCES}
    referenced = {name: set() for name in REFERENCES}

    for name, references in REFERENCES.items():
        fields = {"_id": name, **references}
        query = {"$or": [{field: {"$type": "string"}} for field in fields]}
        projection = dict.fromkeys(fields, 1)
        with database[name].find(query, projection, session=session) as records:
            for record in records:
                updates = {}
                for field, target in fields.items():
                    value = read_path(record, field)
                    if not isinstance(value, str):
                        continue
                    if not ObjectId.is_valid(value):
                        issues[f"{name}.{field}: giá trị không phải chuỗi 24 ký tự hex"] += 1
                        continue

                    object_id = ObjectId(value)
                    if field == "_id":
                        if object_id in primary[name]:
                            issues[f"{name}._id: nhiều chuỗi có cùng ObjectId đích"] += 1
                        primary[name].add(object_id)
                        if name in {"fs.files", "knowledge_bases"} and str(object_id) != value:
                            issues[f"{name}._id: đổi chữ hoa có thể làm lệch khóa trong Chroma"] += 1
                    else:
                        referenced[target].add(object_id)
                    updates[field] = object_id

                if updates:
                    changes[name].append(Change(record["_id"], updates))

    for name in REFERENCES:
        needed = list(primary[name] | referenced[name])
        existing = set()
        for start in range(0, len(needed), BATCH_SIZE):
            batch = needed[start:start + BATCH_SIZE]
            with database[name].find({"_id": {"$in": batch}}, {"_id": 1}, session=session) as records:
                existing.update(record["_id"] for record in records)
        conflicts = primary[name] & existing
        missing = referenced[name] - existing - primary[name]
        if conflicts:
            issues[f"{name}._id: ObjectId đích đã tồn tại"] += len(conflicts)
        if missing:
            issues[f"{name}._id: thiếu bản ghi đích của tham chiếu"] += len(missing)

    return MigrationPlan(changes, issues)


def apply_batch(database: Database, name: str, changes: list[Change], session: ClientSession) -> None:
    collection = database[name]
    rekeys = [change for change in changes if "_id" in change.updates]
    replacements = {}
    if rekeys:
        old_ids = [change.original_id for change in rekeys]
        with collection.find({"_id": {"$in": old_ids}}, session=session) as records:
            replacements = {record["_id"]: record for record in records}

    inserts = []
    updates = []
    for change in changes:
        if "_id" not in change.updates:
            updates.append(UpdateOne({"_id": change.original_id}, {"$set": change.updates}))
            continue

        record = replacements.get(change.original_id)
        if record is None:
            raise MigrationBlocked(f"Bản ghi nguồn trong {name} đã thay đổi.")
        for path, value in change.updates.items():
            parent_path, _, field = path.rpartition(".")
            parent = read_path(record, parent_path) if parent_path else record
            parent[field] = value
        inserts.append(InsertOne(record))

    # MongoDB không cho sửa trực tiếp _id, nên thay bản cũ bằng bản có ObjectId trong cùng giao dịch.
    deletes = [DeleteOne({"_id": change.original_id}) for change in rekeys]
    result = collection.bulk_write([*deletes, *inserts, *updates], ordered=True, session=session)
    if result.deleted_count != len(deletes) or result.matched_count != len(updates):
        raise MigrationBlocked(f"Số bản ghi trong {name} đã thay đổi khi ghi.")


def migrate_object_ids(database: Database, *, apply: bool = False) -> MigrationPlan:
    """Preview legacy IDs, or migrate the configured collections in a transaction."""
    plan = plan_migration(database)
    if not apply or plan.issues or not plan.record_count:
        return plan

    def write(current_session: ClientSession) -> MigrationPlan:
        # Rà lại dữ liệu trong transaction vì trạng thái lúc xem trước có thể đã thay đổi.
        current = plan_migration(database, current_session)
        if current.issues:
            return current

        for name, changes in current.changes.items():
            for start in range(0, len(changes), BATCH_SIZE):
                apply_batch(database, name, changes[start:start + BATCH_SIZE], current_session)
        return current

    with database.client.start_session() as session:
        return session.with_transaction(
            write, read_concern=ReadConcern("snapshot"), write_concern=WriteConcern("majority"),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Chuyển ID MongoDB cũ của VIT AI sang ObjectId.")
    parser.add_argument("--apply", action="store_true", help="Ghi thay đổi. Mặc định chỉ xem trước.")
    options = parser.parse_args()

    from app.core.config import settings
    from app.db.mongodb import create_mongo_client

    try:
        with create_mongo_client() as client:
            database = client[settings.mongodb_database]
            print(f"Database: {database.name}", flush=True)
            plan = migrate_object_ids(database, apply=options.apply)
    except (MigrationBlocked, PyMongoError) as error:
        print(f"Migration không hoàn tất ({type(error).__name__}).")
        if isinstance(error, MigrationBlocked):
            print(error)
        return 1

    for name, changes in plan.changes.items():
        print(f"{name}: {len(changes)} bản ghi")
    for issue, count in plan.issues.items():
        print(f"Cần xử lý {count} trường hợp {issue}.")
    if plan.issues:
        print("Dừng trước khi ghi thay đổi.")
        return 2

    verb = "Đã chuyển" if options.apply else "Xem trước"
    print(f"{verb}: {plan.record_count} bản ghi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
