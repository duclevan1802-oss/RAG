from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    mongodb_uri: str
    mongodb_database: str = "rag_local"
    ollama_base_url: str ="http://127.0.0.1:11434"
    ollama_model: str = "qwen3:4b"
    embedding_model: str = "AITeamVN/Vietnamese_Embedding"
    chroma_dir: Path = BACKEND_DIR.parent / "storage" / "chroma"
    chroma_collection: str = "vietnamese_documents_v1"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173",]
    
settings = Settings()