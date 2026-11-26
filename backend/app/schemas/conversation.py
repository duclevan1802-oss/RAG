# Định nghĩa hội thoại, tin nhắn và cấu trúc một trang lịch sử.

from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from app.core.constants import (
    CONVERSATION_DEFAULT_TITLE,
    CONVERSATION_TITLE_MAX_LENGTH,
    MESSAGE_MAX_LENGTH,
)
from app.schemas.chat import QuestionText
from app.schemas.retrieval import RetrievedChunk

_question_adapter = TypeAdapter(QuestionText)


class ConversationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: QuestionText

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


class MessageData(BaseModel):
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


# Áp giới hạn câu hỏi cho tin nhắn mới của người dùng. Câu trả lời AI có giới hạn riêng.
class MessageCreate(MessageData):
    @model_validator(mode="after")
    def validate_user_question(self) -> Self:
        if self.role == "user":
            self.content = _question_adapter.validate_python(self.content)
        return self


# Đọc được cả tin nhắn cũ từng được lưu theo giới hạn dài hơn.
class MessageResponse(MessageData):
    id: str
    conversation_id: str
    created_at: datetime


# next_before_id đánh dấu tin cũ nhất của trang để lấy các tin đứng trước nó.
class MessagePage(BaseModel):
    messages: list[MessageResponse]
    next_before_id: str | None = None


class ConversationStarted(BaseModel):
    conversation: ConversationResponse
    message: MessageResponse

class ConversationDeleteResponse(BaseModel):
    id: str
    message: str = "Đã xóa hội thoại và tin nhắn."
