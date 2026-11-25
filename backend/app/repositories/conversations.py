from datetime import datetime, timezone

from app.core.config import settings
from app.db.mongodb import create_mongo_client
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationStarted,
    MessageCreate,
    MessageResponse,
    ConversationDeleteResponse,
)
from app.core.constants import (
    CONVERSATION_AUTO_TITLE_LENGTH,
    CONVERSATION_DEFAULT_TITLE,
)

from bson import ObjectId

def conversation_from_mongo(document: dict) -> ConversationResponse:
    created_at = document["created_at"]
    updated_at = document["updated_at"]

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)

    return ConversationResponse(
        id=str(document["_id"]),
        title=document["title"],
        created_at=created_at,
        updated_at=updated_at,
    )


def create_conversation(
    data: ConversationCreate,
) -> ConversationStarted:
    now = datetime.now(timezone.utc)

    conversation_id = ObjectId()
    message_id = ObjectId()

    if data.title == CONVERSATION_DEFAULT_TITLE:
        title = data.content[
            :CONVERSATION_AUTO_TITLE_LENGTH
        ]
    else:
        title = data.title

    conversation_document = {
        "_id": conversation_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
    }

    message_document = {
        "_id": message_id,
        "conversation_id": conversation_id,
        "role": "user",
        "content": data.content,
        "thinking": None,
        "sources": [],
        "status": "completed",
        "created_at": now,
    }

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        with client.start_session() as session:

            def save_first_message(current_session):
                database["conversations"].insert_one(
                    conversation_document,
                    session=current_session,
                )

                database["messages"].insert_one(
                    message_document,
                    session=current_session,
                )

            session.with_transaction(
                save_first_message,
            )

    return ConversationStarted(
        conversation=conversation_from_mongo(
            conversation_document,
        ),
        message=message_from_mongo(
            message_document,
        ),
    )


def list_conversations(
    skip: int = 0,
    limit: int = 20,
) -> list[ConversationResponse]:
    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        collection = database["conversations"]

        documents = (
            collection
            .find({})
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return [
            conversation_from_mongo(document)
            for document in documents
        ]

def parse_conversation_id(conversation_id: str) -> ObjectId:
    if not ObjectId.is_valid(conversation_id):
        raise ValueError("ID hội thoại không hợp lệ.")

    return ObjectId(conversation_id)


def conversation_message_filter(
    conversation_id: ObjectId,
) -> dict:
    """Khớp dữ liệu mới dùng ObjectId và dữ liệu cũ dùng string."""
    return {
        "conversation_id": {
            "$in": [
                conversation_id,
                str(conversation_id),
            ]
        }
    }

def message_from_mongo(document: dict) -> MessageResponse:
    created_at = document["created_at"]

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return MessageResponse(
        id=str(document["_id"]),
        conversation_id=str(document["conversation_id"]),
        role=document["role"],
        content=document["content"],
        thinking=document.get("thinking"),
        sources=document.get("sources", []),
        status=document.get("status", "completed"),
        created_at=created_at,
    )

def add_message(
    conversation_id: str,
    data: MessageCreate,
) -> MessageResponse:
    object_id = parse_conversation_id(conversation_id)

    now = datetime.now(timezone.utc)

    document = {
        "conversation_id": object_id,
        "role": data.role,
        "content": data.content,
        "thinking": data.thinking,
        "sources": [
            source.model_dump()
            for source in data.sources
        ],
        "status": data.status,
        "created_at": now,
    }

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        conversation = database["conversations"].find_one(
            {"_id": object_id}
        )

        if conversation is None:
            raise LookupError("Không tìm thấy hội thoại.")

        result = database["messages"].insert_one(document)

        database["conversations"].update_one(
            {"_id": object_id},
            {"$set": {"updated_at": now}},
        )

        if data.role == "user":
            first_user_filter = conversation_message_filter(
                object_id
            )
            first_user_filter["role"] = "user"

            first_user_message = database["messages"].find_one(
                first_user_filter,
                sort=[
                    ("created_at", 1),
                    ("_id", 1),
                ],
            )

            if (
                first_user_message is not None
                and first_user_message["_id"] == result.inserted_id
            ):
                title = data.content.strip()[
                    :CONVERSATION_AUTO_TITLE_LENGTH
                ]

                if title:
                    database["conversations"].update_one(
                        {
                            "_id": object_id,
                            "title": CONVERSATION_DEFAULT_TITLE,
                        },
                        {
                            "$set": {
                                "title": title,
                            }
                        },
                    )

    document["_id"] = result.inserted_id

    return message_from_mongo(document)

def list_messages(
    conversation_id: str,
    skip: int = 0,
    limit: int = 100,
) -> list[MessageResponse]:
    object_id = parse_conversation_id(conversation_id)

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        conversation = database["conversations"].find_one(
            {"_id": object_id}
        )

        if conversation is None:
            raise LookupError("Không tìm thấy hội thoại.")

        documents = (
            database["messages"]
            .find(conversation_message_filter(object_id))
            .sort([
                ("created_at", 1),
                ("_id", 1),
            ])
            .skip(skip)
            .limit(limit)
        )

        return [
            message_from_mongo(document)
            for document in documents
        ]

def list_recent_messages_for_llm(
    conversation_id: str,
    current_message_id: str,
    limit: int = 10,
) -> list[dict[str, str]]:
    conversation_object_id = parse_conversation_id(
        conversation_id
    )

    if not ObjectId.is_valid(current_message_id):
        raise ValueError(
            "ID tin nhắn hiện tại không hợp lệ."
        )

    current_message_object_id = ObjectId(
        current_message_id
    )

    with create_mongo_client() as client:
        database = client[
            settings.mongodb_database
        ]

        conversation = database[
            "conversations"
        ].find_one(
            {
                "_id":
                    conversation_object_id,
            }
        )

        if conversation is None:
            raise LookupError(
                "Không tìm thấy hội thoại."
            )

        messages_collection = database[
            "messages"
        ]

        current_message = (
            messages_collection.find_one(
                {
                    "_id":
                        current_message_object_id,
                    "conversation_id":
                        conversation_object_id,
                    "role": "user",
                }
            )
        )

        if current_message is None:
            raise LookupError(
                "Không tìm thấy tin nhắn hiện tại "
                "trong hội thoại."
            )

        documents = list(
            messages_collection
            .find(
                {
                    "conversation_id":
                        conversation_object_id,

                    "_id": {
                        "$ne":
                            current_message_object_id,
                    },

                    "role": {
                        "$in": [
                            "user",
                            "assistant",
                        ]
                    },

                    "status": "completed",

                    "content": {
                        "$ne": "",
                    },
                },
                {
                    "_id": 0,
                    "role": 1,
                    "content": 1,
                },
            )
            .sort([
                ("created_at", -1),
                ("_id", -1),
            ])
            .limit(limit)
        )

    documents.reverse()

    return [
        {
            "role": document["role"],
            "content": document["content"],
        }
        for document in documents
    ]


def delete_conversation(
    conversation_id: str,
) -> ConversationDeleteResponse:
    object_id = parse_conversation_id(conversation_id)

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]

        with client.start_session() as session:
            with session.start_transaction():
                result = database["conversations"].delete_one(
                    {"_id": object_id},
                    session=session,
                )

                if result.deleted_count == 0:
                    raise LookupError("Không tìm thấy hội thoại.")

                database["messages"].delete_many(
                    conversation_message_filter(object_id),
                    session=session,
                )

    return ConversationDeleteResponse(
        id=str(object_id),
    )
