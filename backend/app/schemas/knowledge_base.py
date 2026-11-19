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

    @classmethod
    def from_mongo(cls, document: Mapping[str, Any]) -> Self:
        return cls(
            id=str(document["_id"]),
            name=document["name"],
            description=document.get("description", ""),
        )


class KnowledgeBaseDeleteResponse(BaseModel):
    id: str
    message: str = "Đã xóa bộ tài liệu."
