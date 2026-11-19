from fastapi import APIRouter, HTTPException, Query
from pymongo.errors import PyMongoError

from app.repositories.conversations import (
    add_message,
    create_conversation,
    list_conversations,
    list_messages,
    delete_conversation,
)
from app.schemas.conversation import (
    ConversationCreate,
    ConversationStarted,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    ConversationDeleteResponse,
)


router = APIRouter(
    prefix="/api/conversations",
    tags=["conversations"],
)


def run_conversation_action(function, *args):
    try:
        return function(*args)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except LookupError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except PyMongoError as error:
        raise HTTPException(
            status_code=503,
            detail="Không kết nối được MongoDB.",
        ) from error


@router.post(
    "",
    response_model=ConversationStarted,
    status_code=201,
)
def create(body: ConversationCreate):
    return run_conversation_action(
        create_conversation,
        body,
    )


@router.get(
    "",
    response_model=list[ConversationResponse],
)
def get_all(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    return run_conversation_action(
        list_conversations,
        skip,
        limit,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=201,
)
def create_message(
    conversation_id: str,
    body: MessageCreate,
):
    return run_conversation_action(
        add_message,
        conversation_id,
        body,
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def get_messages(
    conversation_id: str,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
):
    return run_conversation_action(
        list_messages,
        conversation_id,
        skip,
        limit,
    )

@router.delete(
    "/{conversation_id}",
    response_model=ConversationDeleteResponse,
)
def delete(conversation_id: str):
    return run_conversation_action(
        delete_conversation,
        conversation_id,
    )
