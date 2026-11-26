# Định nghĩa nguồn RAG, gồm nội dung đoạn, vị trí, khoảng cách và số trích dẫn.

from pydantic import BaseModel, Field

class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    text: str
    distance: float
    page_number: int | None = None
    block_number: int | None = None
    source_number: int | None = Field(default=None, ge=1)
