from bson import ObjectId

from app.core.config import settings
from app.db.chroma import get_document_collection
from app.db.mongodb import create_mongo_client
from app.schemas.retrieval import RetrievedChunk
from app.services.embeddings import create_embeddings
from app.core.constants import (RETRIEVAL_MAX_DISTANCE, RETRIEVAL_MIN_TEXT_LENGTH,)

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

    if collection.count() == 0:
        return []

   
    question_vector = create_embeddings([question])[0]

    
    results = collection.query(
        query_embeddings=[question_vector],
        n_results=top_k * 3,
        where=({"knowledge_base_id": knowledge_base_id}if knowledge_base_id is not None else None),
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

    if not document_ids:
        return []

    
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        file_filter = {
            "_id": {
                "$in": [
                    ObjectId(document_id)
                    for document_id in document_ids
                ]
            },
            "metadata.status": "ready",
        }

        if knowledge_base_id is not None:
            file_filter["metadata.knowledge_base_id"] = ObjectId(
                knowledge_base_id
            )

        ready_files = database["fs.files"].find(
            file_filter,
            {"_id": 1, "filename": 1},
)

        ready_filenames = {
            str(file["_id"]): file["filename"]
            for file in ready_files
        }

    chunks: list[RetrievedChunk] = []

    for chunk_id, text, metadata, distance in zip(
        ids,
        texts,
        metadatas,
        distances,
    ):
        if not metadata or not text:
            continue

        if len(text.strip()) < RETRIEVAL_MIN_TEXT_LENGTH:
            continue        
        
        if not metadata or not text:
            continue
        if (
            distance is None
            or distance >
                RETRIEVAL_MAX_DISTANCE
        ):
            continue        
        document_id = metadata.get("document_id")

        if document_id not in ready_filenames:
            continue

        chunks.append(
            RetrievedChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                filename=ready_filenames[document_id],
                text=text,
                distance=distance,
                page_number=metadata.get("page_number"),
                block_number=metadata.get("block_number"),
                source_number=len(chunks) + 1,
            )
        )

        if len(chunks) == top_k:
            break

    return chunks
