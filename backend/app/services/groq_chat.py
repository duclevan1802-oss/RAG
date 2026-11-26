from collections.abc import AsyncIterator
from functools import lru_cache

from langchain_groq import ChatGroq

from app.core.config import settings
from app.schemas.chat import ChatResponse, RagStreamEvent


class GroqResponseError(Exception):
    pass


@lru_cache(maxsize=1)
def get_groq_model() -> ChatGroq:
    key = settings.groq_api_key
    if key is None or not key.get_secret_value().strip():
        raise GroqResponseError("Chưa cấu hình GROQ_API_KEY.")

    return ChatGroq(
        model=settings.groq_model,
        api_key=key.get_secret_value(),
        reasoning_effort="low",
        max_tokens=2048,
        timeout=60.0,
        max_retries=0,
    )


def build_messages(
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> list[tuple[str, str]]:
    messages = [("system", "Bạn là VIT AI. Trả lời rõ ràng bằng tiếng Việt.")]
    messages.extend(
        (item["role"], item["content"]) for item in (history or [])
    )
    messages.append(("human", prompt))
    return messages


async def ask_groq(prompt: str) -> ChatResponse:
    response = await get_groq_model().ainvoke(build_messages(prompt))
    content = response.content
    if not isinstance(content, str) or not content.strip():
        raise GroqResponseError("Model chưa tạo được câu trả lời.")

    return ChatResponse(
        content=content.strip(),
        done_reason=response.response_metadata.get("finish_reason"),
    )


async def stream_groq(
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[RagStreamEvent]:
    finish_reason = None
    has_content = False
    reported_progress = False

    async for chunk in get_groq_model().astream(build_messages(prompt, history)):
        if (
            not reported_progress
            and not has_content
            and chunk.additional_kwargs.get("reasoning_content")
        ):
            reported_progress = True
            yield RagStreamEvent(type="progress", content="Đang suy nghĩ…")

        content = chunk.content
        if isinstance(content, str) and content:
            has_content = has_content or bool(content.strip())
            yield RagStreamEvent(type="token", content=content)

        reason = chunk.response_metadata.get("finish_reason")
        if isinstance(reason, str):
            finish_reason = reason

    if not has_content or finish_reason is None:
        raise GroqResponseError("Luồng trả lời kết thúc trước khi hoàn tất.")

    yield RagStreamEvent(type="done", done_reason=finish_reason)
