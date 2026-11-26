# Định nghĩa dữ liệu bộ tài liệu khi tạo mới và khi trả về giao diện.

from collections.abc import Mapping
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeBaseCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)


class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    description: str
    document_count: int | None = Field(default=None, ge=0)
    @classmethod
    def from_mongo(cls, document: Mapping[str, Any]) -> Self:
        return cls(
            id=str(document["_id"]),
            name=document["name"],
            description=document.get("description", ""),
            document_count=document.get("document_count"),
        )


class KnowledgeBaseDeleteResponse(BaseModel):
    id: str
    message: str = "Đã xóa bộ tài liệu."
