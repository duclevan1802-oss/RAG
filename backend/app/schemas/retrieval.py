from pydantic import BaseModel

class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    text: str
    distance: float
    page_number: int | None = None
    block_number: int | None = None