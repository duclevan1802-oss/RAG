from app.core.config import settings
from bson import ObjectId
from app.db.mongodb import create_mongo_client
from pymongo import ReturnDocument
from app.schemas.knowledge_base import KnowledgeBaseDeleteResponse, KnowledgeBaseResponse
from app.repositories.documents import knowledge_base_file_filter

def create_knowledge_base(name: str, description: str) -> KnowledgeBaseResponse:
    document = {
        "name": name,
        "description": description,
    }

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        collection = database["knowledge_bases"]

        result = collection.insert_one(document)

    document["_id"] = result.inserted_id
    return KnowledgeBaseResponse.from_mongo(document)

def get_or_create_knowledge_base(name: str):
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        collection = database["knowledge_bases"]

        document = collection.find_one_and_update(
            {"name": name},
            {"$setOnInsert": {"description": ""}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        return str(document["_id"])

def list_knowledge_bases(
    skip: int = 0,
    limit: int = 20,
) -> list[KnowledgeBaseResponse]:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        bases = list(
            database["knowledge_bases"]
            .find({})
            .sort("_id", -1)
            .skip(skip)
            .limit(limit)
        )
        if not bases:
            return []

        base_ids = [base["_id"] for base in bases]
        file_counts = database["fs.files"].aggregate([
            {"$match": {"metadata.knowledge_base_id": {"$in": base_ids}}},
            {"$group": {"_id": "$metadata.knowledge_base_id", "count": {"$sum": 1}}},
        ])
        counts = {row["_id"]: row["count"] for row in file_counts}

        return [
            KnowledgeBaseResponse.from_mongo({
                **base,
                "document_count": counts.get(base["_id"], 0),
            })
            for base in bases
        ]


def find_knowledge_base_by_name(name: str) -> KnowledgeBaseResponse:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        document = database["knowledge_bases"].find_one(
            {"name": name}
        )

        if document is None:
            raise LookupError("Không tìm thấy bộ tài liệu.")

        return KnowledgeBaseResponse.from_mongo(document)


def find_knowledge_base_by_id(knowledge_base_id: str) -> KnowledgeBaseResponse:
    with create_mongo_client() as client:
        document = client[settings.mongodb_database]["knowledge_bases"].find_one(
            {"_id": ObjectId(knowledge_base_id)}
        )
        if document is None:
            raise LookupError("Không tìm thấy bộ tài liệu.")
        return KnowledgeBaseResponse.from_mongo(document)


def update_knowledge_base_by_id(
    knowledge_base_id: str,
    new_name: str,
    description: str,
) -> KnowledgeBaseResponse:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        document = database["knowledge_bases"].find_one_and_update(
            {"_id": ObjectId(knowledge_base_id)},
            {
                "$set": {
                    "name": new_name,
                    "description": description,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

        if document is None:
            raise LookupError("Không tìm thấy bộ tài liệu.")

        return KnowledgeBaseResponse.from_mongo(document)


def delete_knowledge_base_by_id(knowledge_base_id: str) -> KnowledgeBaseDeleteResponse:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        collection = database["knowledge_bases"]

        document = collection.find_one({"_id": ObjectId(knowledge_base_id)})

        if document is None:
            raise LookupError("Không tìm thấy bộ tài liệu.")

        file = database["fs.files"].find_one(
            knowledge_base_file_filter(document["_id"])
        )

        if file is not None:
            raise ValueError("Bộ tài liệu đang có file, chưa thể xóa.")

        result = collection.delete_one({"_id": document["_id"]})

        if result.deleted_count == 0:
            raise LookupError("Bộ tài liệu không còn tồn tại.")

        return KnowledgeBaseDeleteResponse(id=str(document["_id"]))
