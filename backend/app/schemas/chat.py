from pydantic import BaseModel, ConfigDict, Field
from app.schemas.retrieval import RetrievedChunk
from typing import Literal


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=1, max_length=16000)


class ChatResponse(BaseModel):
    content: str
    done_reason: str | None = None

class RagChatRequest(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True, 
        extra="forbid"
    )

    question: str = Field(
        min_length=1, 
        max_length=16000
    )
    knowledge_base_id: str | None = Field(
        default=None, 
        min_length=1, 
        max_length=100)

    conversation_id: str = Field(
        min_length=24,
        max_length=24,
    )

    current_message_id: str = Field(
        min_length=24,
        max_length=24,
    )

class RagChatResponse(ChatResponse):
    sources: list[RetrievedChunk] = Field(default_factory=list)


class RagStreamEvent(BaseModel):
    type: Literal["sources", "thinking", "token", "done", "error"]
    content: str | None = None
    sources: list[RetrievedChunk] | None = None
    done_reason: str | None = None
