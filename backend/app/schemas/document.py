from collections.abc import Mapping
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field


class DocumentRename(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    filename: str = Field(
        min_length=1,
        max_length=255,
        pattern=r"^[^/\\\x00]+$",
    )


class DocumentResponse(BaseModel):
    id: str
    filename: str
    size: int
    knowledge_base_id: str
    knowledge_base_name: str | None = None
    status: str
    chunk_count: int = 0
    error: str | None = None

    @classmethod
    def from_gridfs(
        cls,
        document: Mapping[str, Any],
        knowledge_base_name: str | None = None,
    ) -> Self:
        """Chuyển bản ghi GridFS thành đối tượng phản hồi document."""
        metadata = document.get("metadata", {})
        return cls(
            id=str(document["_id"]),
            filename=document["filename"],
            size=document["length"],
            knowledge_base_id=str(metadata.get("knowledge_base_id", "")),
            knowledge_base_name=knowledge_base_name,
            status=metadata.get("status", "uploaded"),
            chunk_count=metadata.get("chunk_count", 0),
            error=metadata.get("error"),
        )


class DocumentDeleteResponse(BaseModel):
    id: str
    filename: str | None = None
    message: str = "Đã hoàn tất xóa file và dữ liệu còn sót."

class DocumentPageText(BaseModel):
    page_number: int
    text: str
    has_text: bool


class DocumentTextResponse(BaseModel):
    id: str
    filename: str
    total_pages: int
    pages: list[DocumentPageText]

class DocumentTextBlock(BaseModel):
    block_number: int
    kind: str
    text: str
    has_text: bool

class DOCXTextResponse(BaseModel):
    id: str
    filename: str
    total_blocks: int
    blocks: list[DocumentTextBlock]

class DocumentChunk(BaseModel):
    chunk_number: int
    text: str
    page_number: int | None = None
    block_number: int | None = None

class DocumentChunksResponse(BaseModel):
    id: str
    filename: str
    chunk_size: int
    overlap: int
    total_chunks: int
    chunks: list[DocumentChunk]
