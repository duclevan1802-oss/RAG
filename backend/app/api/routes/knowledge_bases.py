from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.repositories.knowledge_bases import (
    create_knowledge_base,
    delete_knowledge_base_by_id,
    find_knowledge_base_by_id,
    list_knowledge_bases,
    update_knowledge_base_by_id,
)
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate,
    KnowledgeBaseDeleteResponse,
    KnowledgeBaseResponse,
)


router = APIRouter(
    prefix="/api/knowledge-bases",
    tags=["knowledge-bases"],
)


def validate_id(knowledge_base_id: str):
    if not ObjectId.is_valid(knowledge_base_id):
        raise HTTPException(400, "ID bộ tài liệu không hợp lệ.")
    return str(ObjectId(knowledge_base_id))


def run_repository(function, *args):
    try:
        return function(*args)

    except DuplicateKeyError:
        raise HTTPException(409, "Tên bộ tài liệu đã tồn tại.")

    except LookupError as error:
        raise HTTPException(404, str(error))

    except ValueError as error:
        raise HTTPException(409, str(error))

    except PyMongoError:
        raise HTTPException(503, "Không thực hiện được thao tác MongoDB.")


@router.post(
    "",
    response_model=KnowledgeBaseResponse,
    status_code=201,
)
def create(body: KnowledgeBaseCreate):
    return run_repository(
        create_knowledge_base,
        body.name,
        body.description,
    )


@router.get("", response_model=list[KnowledgeBaseResponse])
def get_all(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    return run_repository(
        list_knowledge_bases,
        skip,
        limit,
    )


@router.get("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
def get_detail(knowledge_base_id: str):
    return run_repository(
        find_knowledge_base_by_id,
        validate_id(knowledge_base_id),
    )


@router.put("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
def update(knowledge_base_id: str, body: KnowledgeBaseCreate):
    return run_repository(
        update_knowledge_base_by_id,
        validate_id(knowledge_base_id),
        body.name,
        body.description,
    )


@router.delete("/{knowledge_base_id}", response_model=KnowledgeBaseDeleteResponse)
def delete(knowledge_base_id: str):
    return run_repository(
        delete_knowledge_base_by_id,
        validate_id(knowledge_base_id),
    )
