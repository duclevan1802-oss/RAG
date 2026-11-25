from datetime import datetime, timezone

from bson import ObjectId

from app.core.config import settings
from app.db.mongodb import create_mongo_client
from app.schemas.document import (
    DocumentChunksResponse,
    StoredDocumentChunk,
)


COLLECTION_NAME = "document_chunks"


def chunk_from_mongo(
    document: dict,
) -> StoredDocumentChunk:
    created_at = document["created_at"]

    if created_at.tzinfo is None:
        created_at = created_at.replace(
            tzinfo=timezone.utc,
        )

    return StoredDocumentChunk(
        id=str(document["_id"]),
        document_id=str(
            document["document_id"]
        ),
        knowledge_base_id=str(
            document["knowledge_base_id"]
        ),
        chunk_number=document[
            "chunk_number"
        ],
        text=document["text"],
        page_number=document.get(
            "page_number"
        ),
        block_number=document.get(
            "block_number"
        ),
        chunk_size=document["chunk_size"],
        overlap=document["overlap"],
        created_at=created_at,
    )

def replace_document_chunks(
    document: DocumentChunksResponse,
    knowledge_base_id: str,
) -> int:
    document_id = ObjectId(document.id)
    knowledge_base_object_id = ObjectId(
        knowledge_base_id
    )

    now = datetime.now(timezone.utc)

    records = []

    for chunk in document.chunks:
        records.append({
            "_id": ObjectId(),
            "document_id": document_id,
            "knowledge_base_id":
                knowledge_base_object_id,
            "chunk_number":
                chunk.chunk_number,
            "text": chunk.text,
            "page_number":
                chunk.page_number,
            "block_number":
                chunk.block_number,
            "chunk_size":
                document.chunk_size,
            "overlap":
                document.overlap,
            "created_at": now,
        })

    with create_mongo_client() as client:
        database = client[
            settings.mongodb_database
        ]

        collection = database[
            COLLECTION_NAME
        ]

        with client.start_session() as session:

            def replace(current_session):
                collection.delete_many(
                    {
                        "document_id":
                            document_id,
                    },
                    session=current_session,
                )

                if records:
                    collection.insert_many(
                        records,
                        session=current_session,
                    )

            session.with_transaction(replace)

    return len(records)

def list_document_chunks(
    file_id: str,
) -> list[StoredDocumentChunk]:
    document_id = ObjectId(file_id)

    with create_mongo_client() as client:
        database = client[
            settings.mongodb_database
        ]

        documents = (
            database[COLLECTION_NAME]
            .find({
                "document_id": document_id,
            })
            .sort("chunk_number", 1)
        )

        return [
            chunk_from_mongo(document)
            for document in documents
        ]

def delete_mongo_document_chunks(
    file_id: str,
) -> int:
    document_id = ObjectId(file_id)

    with create_mongo_client() as client:
        database = client[
            settings.mongodb_database
        ]

        result = database[
            COLLECTION_NAME
        ].delete_many({
            "document_id": document_id,
        })

    return result.deleted_count