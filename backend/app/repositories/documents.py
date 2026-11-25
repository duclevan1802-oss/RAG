"""Truy vấn thông tin và trạng thái tài liệu trong MongoDB."""

from bson import ObjectId
from gridfs.errors import NoFile

from app.core.config import settings
from app.db.mongodb import create_mongo_client
from app.schemas.document import DocumentResponse


def find_file_record(database, file_id: ObjectId):
    """Đọc bản ghi GridFS trong kết nối do nơi gọi quản lý."""
    return database["fs.files"].find_one({"_id": file_id})


def find_knowledge_base_record(database, knowledge_base_id: ObjectId):
    return database["knowledge_bases"].find_one({"_id": knowledge_base_id})


def knowledge_base_file_filter(
    knowledge_base_id: str | ObjectId,
) -> dict:
    """Tạo bộ lọc file theo ObjectId của bộ tài liệu."""
    object_id = (
        knowledge_base_id
        if isinstance(knowledge_base_id, ObjectId)
        else ObjectId(knowledge_base_id)
    )

    return {
        "metadata.knowledge_base_id": object_id,
    }


def mark_file_deleting(database, file_id: ObjectId):
    database["fs.files"].update_one(
        {"_id": file_id},
        {"$set": {"metadata.status": "deleting"}},
    )


def list_atlas_files(knowledge_base_id: str) -> list[DocumentResponse]:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        files = database["fs.files"].find(
            knowledge_base_file_filter(knowledge_base_id)
        )
        return [DocumentResponse.from_gridfs(file) for file in files]


def list_atlas_files_by_name(name: str) -> list[DocumentResponse]:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        knowledge_base = database["knowledge_bases"].find_one({"name": name})
        if knowledge_base is None:
            raise LookupError("Không tìm thấy bộ tài liệu.")
        files = database["fs.files"].find(
            knowledge_base_file_filter(knowledge_base["_id"])
        )
        return [
            DocumentResponse.from_gridfs(file, knowledge_base["name"])
            for file in files
        ]


def get_atlas_file_info(file_id: str) -> DocumentResponse:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        document = find_file_record(database, ObjectId(file_id))
        if document is None:
            raise NoFile("Không tìm thấy file.")

        knowledge_base_id = document.get("metadata", {}).get("knowledge_base_id")
        knowledge_base = None
        if isinstance(knowledge_base_id, ObjectId):
            knowledge_base = find_knowledge_base_record(database, knowledge_base_id)
        name = knowledge_base["name"] if knowledge_base else None
        return DocumentResponse.from_gridfs(document, name)


def update_document_state(
    file_id: str,
    status: str,
    chunk_count: int = 0,
    error: str | None = None,
):
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        result = database["fs.files"].update_one(
            {"_id": ObjectId(file_id)},
            {"$set": {
                "metadata.status": status,
                "metadata.chunk_count": chunk_count,
                "metadata.error": error,
            }},
        )
        if result.matched_count == 0:
            raise NoFile("Không tìm thấy file để cập nhật trạng thái.")
