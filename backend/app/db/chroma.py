from functools import lru_cache

import chromadb

from app.core.config import settings


@lru_cache(maxsize=1)
def get_chroma_client():
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)

    return chromadb.PersistentClient(
        path=str(settings.chroma_dir),
    )


@lru_cache(maxsize=1)
def get_document_collection():
    client = get_chroma_client()

    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=None,
        configuration={
            "hnsw": {
                "space": "cosine",
            }
        },
        metadata={
            "embedding_model": settings.embedding_model,
        },
    )