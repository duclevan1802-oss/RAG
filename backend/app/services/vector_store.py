from app.core.config import settings
from app.db.chroma import get_chroma_client, get_document_collection
from app.schemas.document import DocumentChunksResponse


def save_document_chunks(
    document: DocumentChunksResponse,
    embeddings: list[list[float]],
    knowledge_base_id: str,
) -> int:
    chunks = document.chunks

    if len(chunks) != len(embeddings):
        raise ValueError("So chunk va so embedding khong khop.")

    if not chunks:
        return 0

    collection = get_document_collection()
    client = get_chroma_client()
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
                f"{document.id}:chunk:{chunk.chunk_number}"
            )
            documents.append(chunk.text)
            metadatas.append(metadata)

        collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=batch_embeddings,
            metadatas=metadatas,
        )

    return len(chunks)

def delete_document_chunks(file_id: str):
    collection = get_document_collection()

    collection.delete(
        where={"document_id": file_id}
    )