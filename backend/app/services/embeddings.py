from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import settings
from app.core.constants import EMBEDDING_MAX_SEQ_LENGTH


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    model = SentenceTransformer(settings.embedding_model)
    model.max_seq_length = EMBEDDING_MAX_SEQ_LENGTH

    return model


def create_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    model = get_embedding_model()

    vectors = model.encode(
        texts,
        batch_size=8,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    return vectors.tolist()
