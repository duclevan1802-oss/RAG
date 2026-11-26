# Định nghĩa nội dung câu hỏi, câu trả lời RAG và từng sự kiện trong luồng streaming.

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.constants import QUESTION_MAX_LENGTH
from app.schemas.retrieval import RetrievedChunk

# Các endpoint chat và lưu câu hỏi dùng cùng kiểu này để kiểm tra chiều dài sau khi bỏ khoảng trắng.
QuestionText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=QUESTION_MAX_LENGTH),
]


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: QuestionText


class ChatResponse(BaseModel):
    content: str
    done_reason: str | None = None

class RagChatRequest(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True, 
        extra="forbid"
    )

    question: QuestionText
    knowledge_base_id: str | None = Field(
        default=None, 
        min_length=1, 
        max_length=100)

    conversation_id: str = Field(
        min_length=24,
        max_length=24,
    )

    # ID của câu hỏi đã lưu, dùng để lấy lịch sử trước lượt hỏi hiện tại.
    current_message_id: str = Field(
        min_length=24,
        max_length=24,
    )

class RagChatResponse(ChatResponse):
    sources: list[RetrievedChunk] = Field(default_factory=list)


# Một dòng phản hồi có thể mang nguồn, trạng thái, phần suy nghĩ, token, lỗi hoặc tín hiệu kết thúc.
class RagStreamEvent(BaseModel):
    type: Literal["sources", "progress", "thinking", "token", "done", "error"]
    content: str | None = None
    sources: list[RetrievedChunk] | None = None
    done_reason: str | None = None
