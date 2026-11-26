# Lưu hội thoại và tin nhắn, phân trang lịch sử và chọn ngữ cảnh gửi cho model.

from datetime import datetime, timezone

from app.core.config import settings
from app.db.mongodb import create_mongo_client
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationStarted,
    MessageCreate,
    MessagePage,
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

    # Dùng phần đầu câu hỏi làm tiêu đề nếu người dùng chưa đặt tên riêng.
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

            # Ghi hội thoại và tin nhắn đầu tiên cùng lúc để tránh xuất hiện một hội thoại rỗng trong Atlas.
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

# MongoDB lưu ObjectId. API đổi ID sang chuỗi để biểu diễn trong JSON.
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

# Sắp xếp theo thời điểm và ID để phân trang ổn định khi nhiều tin có cùng thời điểm lưu.
def list_message_page(
    conversation_id: str,
    before_id: str | None,
    limit: int,
) -> MessagePage:
    object_id = parse_conversation_id(conversation_id)
    message_filter = conversation_message_filter(object_id)

    with create_mongo_client() as client:
        database = client[settings.mongodb_database]
        if database["conversations"].find_one({"_id": object_id}, {"_id": 1}) is None:
            raise LookupError("Không tìm thấy hội thoại.")

        collection = database["messages"]
        if before_id is not None:
            anchor_ids: list[str | ObjectId] = [before_id]
            if ObjectId.is_valid(before_id):
                anchor_ids.append(ObjectId(before_id))
            anchor = collection.find_one(
                {**message_filter, "_id": {"$in": anchor_ids}},
                {"created_at": 1},
            )
            if anchor is None:
                raise LookupError("Không tìm thấy mốc tải tin nhắn trong hội thoại.")

            message_filter["$or"] = [
                {"created_at": {"$lt": anchor["created_at"]}},
                {
                    "created_at": anchor["created_at"],
                    "$expr": {"$lt": ["$_id", {"$literal": anchor["_id"]}]},
                },
            ]

        documents = list(
            collection.find(message_filter)
            .sort([("created_at", -1), ("_id", -1)])
            # Đọc thêm một bản ghi để biết có còn trang cũ hơn mà không phải đếm toàn bộ lịch sử.
            .limit(limit + 1)
        )

    # Đảo lại thứ tự của trang để giao diện đọc từ tin cũ đến mới.
    messages = [message_from_mongo(document) for document in reversed(documents[:limit])]
    return MessagePage(
        messages=messages,
        next_before_id=messages[0].id if len(documents) > limit else None,
    )


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

    # Truy vấn lấy tin gần nhất trước. Model cần đọc phần lịch sử được chọn theo thứ tự hội thoại.
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
