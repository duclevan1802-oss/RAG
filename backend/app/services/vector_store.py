# Ghi và dọn vector Chroma theo file hoặc theo phiên bản chỉ mục.

from app.core.config import settings
from app.db.chroma import get_chroma_client, get_document_collection
from app.schemas.document import DocumentChunksResponse


def save_document_chunks(
    document: DocumentChunksResponse,
    embeddings: list[list[float]],
    knowledge_base_id: str,
    index_version: str,
) -> int:
    chunks = document.chunks

    if len(chunks) != len(embeddings):
        raise ValueError("So chunk va so embedding khong khop.")

    if not chunks:
        return 0

    collection = get_document_collection()
    client = get_chroma_client()
    # Ghi vector theo lô nhỏ và tuân theo giới hạn của Chroma.
    batch_size = min(64, client.get_max_batch_size())

    for start in range(0, len(chunks), batch_size):
        batch_chunks = chunks[start:start + batch_size]
        batch_embeddings = embeddings[start:start + batch_size]

        ids = []
        documents = []
        metadatas = []

        for chunk in batch_chunks:
            metadata = {
                "document_id": document.id,
                "index_version": index_version,
                "knowledge_base_id": knowledge_base_id,
                "chunk_number": chunk.chunk_number,
                "chunk_size": document.chunk_size,
                "overlap": document.overlap,
                "embedding_model": settings.embedding_model,
            }

            if chunk.page_number is not None:
                metadata["page_number"] = chunk.page_number

            if chunk.block_number is not None:
                metadata["block_number"] = chunk.block_number

            ids.append(
                f"{document.id}:{index_version}:chunk:{chunk.chunk_number}"
            )
            documents.append(chunk.text)
            metadatas.append(metadata)

        collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=batch_embeddings,
            metadatas=metadatas,
        )

    # Kiểm tra số ID thực sự đọc lại được trước khi worker cho phép dùng phiên bản mới.
    stored = collection.get(where=_index_filter(document.id, index_version), include=[])
    return len(stored["ids"])


def _index_filter(file_id: str, index_version: str) -> dict:
    return {"$and": [{"document_id": file_id}, {"index_version": index_version}]}


def delete_document_index(file_id: str, index_version: str | None) -> None:
    collection = get_document_collection()
    if index_version is not None:
        collection.delete(where=_index_filter(file_id, index_version))
        return

    # Legacy IDs have no version between the document ID and the chunk marker.
    legacy_prefix = f"{file_id}:chunk:"
    file_chunks = collection.get(where={"document_id": file_id}, include=[])
    legacy_ids = [chunk_id for chunk_id in file_chunks["ids"] if chunk_id.startswith(legacy_prefix)]
    if legacy_ids:
        batch_size = get_chroma_client().get_max_batch_size()
        for start in range(0, len(legacy_ids), batch_size):
            collection.delete(ids=legacy_ids[start:start + batch_size])


def delete_document_chunks(file_id: str) -> None:
    collection = get_document_collection()

    collection.delete(
        where={"document_id": file_id}
    )
