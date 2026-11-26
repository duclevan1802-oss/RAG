# Lưu, tải, đổi tên và xóa file gốc trên MongoDB Atlas qua GridFS.

from bson import ObjectId
from gridfs import GridFSBucket
from pathlib import Path
from gridfs.errors import NoFile

from app.core.config import settings
from app.db.mongodb import create_mongo_client
from app.schemas.document import DocumentDeleteResponse, DocumentResponse
from app.repositories.documents import (
    find_file_record,
    find_knowledge_base_record,
    get_atlas_file_info,
    mark_file_deleting,
)
from app.core.document_operations import document_operation
from app.services.vector_store import (
    delete_document_chunks
    as delete_vector_chunks,
)
from app.repositories.document_chunks import (
    delete_mongo_document_chunks,
)

def upload_to_atlas(filename: str, content: bytes, knowledge_base_id: str) -> DocumentResponse:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        knowledge_base_object_id = ObjectId(knowledge_base_id)

        knowledge_base = find_knowledge_base_record(
            database,
            knowledge_base_object_id,
        )

        if knowledge_base is None:
            raise LookupError("Không tìm thấy bộ tài liệu.")

        bucket = GridFSBucket(database)
        metadata = {
            "knowledge_base_id": knowledge_base_object_id,
            "status": "uploaded",
        }

        # GridFS tách metadata file và dữ liệu nhị phân để lưu file gốc cho việc đọc lại.
        file_id = bucket.upload_from_stream(
            filename,
            content,
            metadata=metadata,
        )

       
        document = {
            "_id": file_id,
            "filename": filename,
            "length": len(content),
            "metadata": metadata,
        }
        return DocumentResponse.from_gridfs(document, knowledge_base["name"])


def read_from_atlas(file_id: str):
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        bucket = GridFSBucket(database)

        with bucket.open_download_stream(ObjectId(file_id)) as stream:
            filename = stream.filename
            content = stream.read()

        return filename, content

def rename_atlas_file(file_id: str, filename: str) -> DocumentResponse:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        document = find_file_record(database, ObjectId(file_id))

        if document is None:
            raise NoFile("Không tìm thấy file.")

        old_extension = Path(document["filename"]).suffix.lower()
        new_extension = Path(filename).suffix.lower()

        if old_extension != new_extension:
            raise ValueError(
                "Chỉ được đổi tên, phải giữ nguyên phần mở rộng của file."
            )

        bucket = GridFSBucket(database)
        bucket.rename(ObjectId(file_id), filename)

    return get_atlas_file_info(file_id)

def _delete_atlas_file(file_id: str) -> DocumentDeleteResponse:
    object_id = ObjectId(file_id)

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        bucket = GridFSBucket(database)

        document = find_file_record(database, object_id)
        # Ẩn file khỏi truy xuất trước khi dọn vector, đoạn văn bản và file gốc.
        mark_file_deleting(database, object_id)

        delete_vector_chunks(file_id)
        delete_mongo_document_chunks(file_id)
        try:
            bucket.delete(object_id)

        except NoFile:
            pass

        return DocumentDeleteResponse(
            id=file_id,
            filename=document["filename"] if document else None,
        )

def delete_atlas_file(file_id: str) -> DocumentDeleteResponse:
    with document_operation(file_id):
        canonical_id = str(ObjectId(file_id))

        return _delete_atlas_file(canonical_id)
    
