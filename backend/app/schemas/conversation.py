from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import (
    CONVERSATION_DEFAULT_TITLE,
    CONVERSATION_TITLE_MAX_LENGTH,
    MESSAGE_MAX_LENGTH,
)
from app.schemas.retrieval import RetrievedChunk


class ConversationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=MESSAGE_MAX_LENGTH)

    title: str = Field(
        default=CONVERSATION_DEFAULT_TITLE,
        min_length=1,
        max_length=CONVERSATION_TITLE_MAX_LENGTH,
    )


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    role: Literal["user", "assistant"]

    content: str = Field(
        default="",
        max_length=MESSAGE_MAX_LENGTH,
    )

    thinking: str | None = Field(
        default=None,
        max_length=MESSAGE_MAX_LENGTH,
    )

    sources: list[RetrievedChunk] = Field(
        default_factory=list,
    )

    status: Literal["completed", "failed"] = "completed"


class MessageResponse(MessageCreate):
    id: str
    conversation_id: str
    created_at: datetime


class ConversationStarted(BaseModel):
    conversation: ConversationResponse
    message: MessageResponse

class ConversationDeleteResponse(BaseModel):
    id: str
    message: str = "Đã xóa hội thoại và tin nhắn."
