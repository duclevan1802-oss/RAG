# Tìm các đoạn liên quan trong Chroma rồi đối chiếu phiên bản đang hoạt động ở MongoDB.

from bson import ObjectId

from app.core.config import settings
from app.db.chroma import get_document_collection
from app.db.mongodb import create_mongo_client
from app.schemas.retrieval import RetrievedChunk
from app.services.embeddings import create_embeddings
from app.core.constants import (RETRIEVAL_MAX_DISTANCE, RETRIEVAL_MIN_TEXT_LENGTH,)


def _load_ready_files(document_ids: set[str], knowledge_base_id: str | None) -> dict[str, dict]:
    if not document_ids:
        return {}

    file_filter: dict = {
        "_id": {"$in": [ObjectId(document_id) for document_id in document_ids]},
        "metadata.status": "ready",
    }
    if knowledge_base_id is not None:
        file_filter["metadata.knowledge_base_id"] = ObjectId(knowledge_base_id)

    with create_mongo_client() as client:
        files = client[settings.mongodb_database]["fs.files"].find(
            file_filter,
            {"filename": 1, "metadata.active_index_version": 1},
        )
        return {str(file["_id"]): file for file in files}


def search_document_chunks(
    question: str,
    knowledge_base_id: str | None,
    top_k: int = 5,
) -> list[RetrievedChunk]:
    question = question.strip()

    if not question:
        raise ValueError("Câu hỏi không được để trống.")

    if knowledge_base_id is not None:
        if not ObjectId.is_valid(knowledge_base_id):
            raise ValueError("ID bộ tài liệu không hợp lệ.")

        knowledge_base_id = str(ObjectId(knowledge_base_id))

    if not 1 <= top_k <= 20:
        raise ValueError("top_k phải từ 1 đến 20.")

    collection = get_document_collection()

    total = collection.count()
    if total == 0:
        return []

    question_vector = create_embeddings([question])[0]
    # Lấy dư ứng viên để còn đủ nguồn sau khi lọc theo khoảng cách, nội dung và phiên bản.
    candidate_count = min(top_k * 3, total)
    where = {"knowledge_base_id": knowledge_base_id} if knowledge_base_id is not None else None
    retried_snapshot = False

    while True:
        results = collection.query(
            query_embeddings=[question_vector],
            n_results=candidate_count,
            where=where,
            include=["documents", "metadatas", "distances"],
)
        ids = results["ids"][0]
        texts = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        document_ids = {
            metadata["document_id"]
            for metadata in metadatas
            if metadata
            and isinstance(metadata.get("document_id"), str)
            and ObjectId.is_valid(metadata["document_id"])
        }
        ready_files = _load_ready_files(document_ids, knowledge_base_id)
        chunks: list[RetrievedChunk] = []
        skipped_inactive = False

        for chunk_id, text, metadata, distance in zip(ids, texts, metadatas, distances):
            if (
                not metadata or not text or len(text.strip()) < RETRIEVAL_MIN_TEXT_LENGTH
                or distance is None or distance > RETRIEVAL_MAX_DISTANCE
            ):
                continue
            document_id = metadata.get("document_id")
            file = ready_files.get(document_id) if isinstance(document_id, str) else None
            # Chỉ chọn vector của phiên bản MongoDB đang dùng. Tài liệu cũ chưa có phiên bản thì hai giá trị đều là None.
            if file is None or metadata.get("index_version") != file.get("metadata", {}).get("active_index_version"):
                skipped_inactive = True
                continue

            chunks.append(RetrievedChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                filename=file["filename"],
                text=text,
                distance=distance,
                page_number=metadata.get("page_number"),
                block_number=metadata.get("block_number"),
                source_number=len(chunks) + 1,
            ))
            if len(chunks) == top_k:
                return chunks

        if not skipped_inactive:
            return chunks
        # Mở rộng tìm kiếm nếu các chỉ mục chưa hoạt động chiếm chỗ trong nhóm ứng viên đầu.
        if len(ids) == candidate_count and candidate_count < total:
            candidate_count = min(candidate_count * 2, total)
            continue
        if retried_snapshot:
            return chunks
        # A new version may have become active between the Chroma and Mongo reads.
        retried_snapshot = True
        total = collection.count()
        if total == 0:
            return []
        candidate_count = min(max(candidate_count, top_k * 3), total)
