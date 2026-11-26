import logging
from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pymongo.errors import PyMongoError

from app.schemas.chat import ChatRequest, ChatResponse
from groq import APIError, APITimeoutError, RateLimitError
from app.services.groq_chat import GroqResponseError, ask_groq, stream_groq
from starlette.concurrency import run_in_threadpool

from app.repositories.knowledge_bases import find_knowledge_base_by_id
from app.schemas.chat import RagChatRequest, RagChatResponse, RagStreamEvent
from app.services.rag import (
    build_general_prompt,
    build_rag_prompt,
    build_retrieval_query,
    is_casual_message,
)
from app.services.retrieval import search_document_chunks
from app.repositories.conversations import (list_recent_messages_for_llm,)

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    try:
        result = await ask_groq(body.question)

        if not result.content.strip():
            raise HTTPException(
                status_code=502,
                detail="Model chưa tạo được câu trả lời cuối."
            )

        return result
    
    except RateLimitError as error:
        raise HTTPException(429, "Groq đã chạm hạn mức. Hãy thử lại sau.") from error
    except APITimeoutError as error:
        raise HTTPException(504, "Groq phản hồi quá thời gian chờ.") from error
    except GroqResponseError as error:
        raise HTTPException(502, str(error)) from error
    except APIError as error:
        raise HTTPException(502, "Không lấy được câu trả lời từ Groq.") from error


@router.post("/chat/rag/stream")
async def chat_with_documents_stream(body: RagChatRequest):
    try:
        knowledge_base_id = (
            body.knowledge_base_id
        )

        if knowledge_base_id is not None:
            if not ObjectId.is_valid(
                knowledge_base_id
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "ID bộ tài liệu "
                        "không hợp lệ."
                    ),
                )

            knowledge_base_id = str(
                ObjectId(knowledge_base_id)
            )

            await run_in_threadpool(
                find_knowledge_base_by_id,
                knowledge_base_id,
            )

        history = await run_in_threadpool(
            list_recent_messages_for_llm,
            body.conversation_id,
            body.current_message_id,
            10,
        )

        if is_casual_message(body.question):
            chunks = []
        else:
            search_query = build_retrieval_query(body.question, history)

            chunks = await run_in_threadpool(
                search_document_chunks,
                search_query,
                knowledge_base_id,
                3,
            )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error
    except LookupError as error:
        raise HTTPException(404, "Không tìm thấy bộ tài liệu.") from error
    except PyMongoError as error:
        raise HTTPException(503, "Không kết nối được MongoDB.") from error

    async def generate():
        yield RagStreamEvent(type="sources", sources=chunks).model_dump_json(exclude_none=True) + "\n"
        if chunks:
            prompt = build_rag_prompt(
                question=body.question,
                chunks=chunks,
            )
        else:
            prompt = build_general_prompt(
                body.question
            )
        has_content = False
        try:
            async for event in stream_groq(prompt, history):
                yield event.model_dump_json(exclude_none=True) + "\n"
        except (APIError, GroqResponseError) as error:
            if isinstance(error, RateLimitError):
                detail = "Groq đã chạm hạn mức. Hãy thử lại sau."
            elif isinstance(error, GroqResponseError):
                detail = str(error)
            else:
                detail = "Không nhận được câu trả lời từ Groq."

            event = RagStreamEvent(type="error", content=detail)
            yield event.model_dump_json(exclude_none=True) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.post("/chat/rag", response_model=RagChatResponse)
async def chat_with_documents(body: RagChatRequest):
    try:
       
        knowledge_base_id = body.knowledge_base_id

        if knowledge_base_id is not None:
            if not ObjectId.is_valid(knowledge_base_id):
                raise HTTPException(400, "ID bộ tài liệu không hợp lệ.")
            knowledge_base_id = str(ObjectId(knowledge_base_id))
            knowledge_base = await run_in_threadpool(
                find_knowledge_base_by_id,
                knowledge_base_id,
            )
            knowledge_base_id = knowledge_base.id

        chunks = await run_in_threadpool(
            search_document_chunks,
            body.question,
            knowledge_base_id,
            3,
        )       
        

        if chunks:
            prompt = build_rag_prompt(
                question=body.question,
                chunks=chunks,
            )
        else:
            prompt = build_general_prompt(
                body.question
            )

       
        result = await ask_groq(prompt)

        if not result.content.strip():
            raise HTTPException(
                status_code=502,
                detail="Model chưa tạo được câu trả lời cuối.",
            )

        return RagChatResponse(
            content=result.content,
            done_reason=result.done_reason,
            sources=chunks,
        )

    except LookupError as error:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bộ tài liệu.",
        ) from error

    except PyMongoError as error:
        raise HTTPException(503, "Không kết nối được MongoDB.") from error
    except RateLimitError as error:
        raise HTTPException(429, "Groq đã chạm hạn mức. Hãy thử lại sau.") from error
    except APITimeoutError as error:
        raise HTTPException(504, "Groq phản hồi quá thời gian chờ.") from error
    except GroqResponseError as error:
        raise HTTPException(502, str(error)) from error
    except APIError as error:
        raise HTTPException(502, "Không lấy được câu trả lời từ Groq.") from error

