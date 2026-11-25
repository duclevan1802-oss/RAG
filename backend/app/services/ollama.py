import httpx
from app.core.config import settings
from app.schemas.chat import ChatResponse
import json
from collections.abc import AsyncIterator

class OllamaResponseError(Exception):
    pass

async def ask_qwen(question: str) -> ChatResponse:
    async with httpx.AsyncClient(
        timeout=180,
        trust_env=False
    ) as client:
        response = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "Trả lời bằng tiếng Việt, rõ ràng và ngắn gọn."
                    },
                    {
                        "role": "user",
                        "content": question
                    }
                ],
                "think": True,
                "stream": False,
                "options":{
                    "num_predict":5000
                }
            }
        )

        response.raise_for_status()

        try:
            data = response.json()
        except ValueError as error:
            raise OllamaResponseError(
                "Ollama trả về dữ liệu không phải JSON hợp lệ."
            ) from error

        if not isinstance(data, dict):
            raise OllamaResponseError(
                "Phản hồi Ollama phải là một JSON object."
            )

        message = data.get("message")

        if not isinstance(message, dict):
            raise OllamaResponseError(
                "Phản hồi Ollama thiếu hoặc sai trường message."
            )

        content = message.get("content")

        if not isinstance(content, str):
            raise OllamaResponseError(
                "Phản hồi Ollama thiếu hoặc sai trường content."
            )

        done_reason = data.get("done_reason")

        if done_reason is not None and not isinstance(done_reason, str):
            raise OllamaResponseError(
                "Trường done_reason của Ollama không hợp lệ."
            )

        return ChatResponse(
            content=content.strip(),
            done_reason=done_reason,
        )

async def stream_qwen(
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[dict]:
    completed = False

    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "Bạn là trợ lý AI có khả năng "
                "trả lời bằng kiến thức chung và "
                "thông tin được truy xuất từ tài liệu. "
                "Câu trả lời cuối phải bằng tiếng Việt, "
                "chính xác, tự nhiên và đầy đủ. "
                "Hãy sử dụng lịch sử hội thoại để hiểu "
                "những từ như 'nó', 'phần trên' hoặc "
                "'ý thứ nhất'."
            ),
        },
    ]

    if history:
        messages.extend(history)

    messages.append(
        {
            "role": "user",
            "content": prompt,
        }
    )

    async with httpx.AsyncClient(
        timeout=180,
        trust_env=False,
    ) as client:
        async with client.stream(
            "POST",
            (
                f"{settings.ollama_base_url}"
                "/api/chat"
            ),
            json={
                "model": settings.ollama_model,
                "messages": messages,
                "think": True,
                "stream": True,
                "options": {
                    "num_predict": 5000,
                },
            },
        ) as response:
            response.raise_for_status()

            async for line in response.aiter_lines():
                if not line.strip():
                    continue

                try:
                    data = json.loads(line)
                except json.JSONDecodeError as error:
                    raise OllamaResponseError(
                        "Ollama trả về một dòng "
                        "JSON không hợp lệ."
                    ) from error

                if not isinstance(data, dict):
                    raise OllamaResponseError(
                        "Phản hồi Ollama không phải "
                        "JSON object."
                    )

                if data.get("error"):
                    raise OllamaResponseError(
                        "Ollama báo lỗi khi tạo "
                        "câu trả lời."
                    )

                message = data.get("message")

                if not isinstance(message, dict):
                    raise OllamaResponseError(
                        "Phản hồi Ollama thiếu "
                        "trường message hợp lệ."
                    )

                thinking = message.get(
                    "thinking",
                    "",
                )

                content = message.get(
                    "content",
                    "",
                )

                if not isinstance(thinking, str):
                    raise OllamaResponseError(
                        "Trường thinking của Ollama "
                        "không hợp lệ."
                    )

                if not isinstance(content, str):
                    raise OllamaResponseError(
                        "Trường content của Ollama "
                        "không hợp lệ."
                    )

                if thinking:
                    yield {
                        "type": "thinking",
                        "content": thinking,
                    }

                if content:
                    yield {
                        "type": "token",
                        "content": content,
                    }

                if data.get("done") is True:
                    done_reason = data.get(
                        "done_reason"
                    )

                    if (
                        done_reason is not None
                        and not isinstance(
                            done_reason,
                            str,
                        )
                    ):
                        raise OllamaResponseError(
                            "Trường done_reason "
                            "không hợp lệ."
                        )

                    completed = True

                    yield {
                        "type": "done",
                        "done_reason": done_reason,
                    }

                    return

    if not completed:
        raise OllamaResponseError(
            "Luồng Ollama kết thúc nhưng "
            "không có sự kiện done."
        )