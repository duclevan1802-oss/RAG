# Đầu vào HTTP cho việc tải file, đọc nội dung, lập chỉ mục lại và xóa file.

from mimetypes import guess_type
from pathlib import Path
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from gridfs.errors import NoFile
from pymongo.errors import PyMongoError
from app.core.constants import ALLOWED_EXTENSIONS, MAX_FILE_SIZE
from app.schemas.document import DocumentDeleteResponse, DocumentRename, DocumentResponse

from app.services.storage import (
    read_from_atlas,
    upload_to_atlas,
    delete_atlas_file,
    rename_atlas_file,
)
from app.repositories.documents import get_atlas_file_info, list_atlas_files

from app.repositories.knowledge_bases import find_knowledge_base_by_id
from app.schemas.document import DocumentTextResponse
from app.services.parsers.pdf import PDFParsingError, extract_pdf_text
from app.schemas.document import (DOCXTextResponse,  StoredDocumentChunksResponse,) 

from app.services.parsers.docx import (
    DOCXParsingError,
    extract_docx_text,
)
from app.workers.ingestion import (
    process_uploaded_document,
    reindex_document,
)
from chromadb.errors import ChromaError
from app.core.document_operations import DocumentBusyError
from app.repositories.document_chunks import (list_document_chunks,)

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("", response_model=DocumentResponse, status_code=201)
def upload_document(
    knowledge_base_id: str = Form(...),
    file: UploadFile = File(...),
):
    try:
        if not ObjectId.is_valid(knowledge_base_id):
            raise HTTPException(400, "ID bộ tài liệu không hợp lệ.")
        knowledge_base_id = str(ObjectId(knowledge_base_id))

        filename = Path(file.filename or "").name
        extension = Path(filename).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(415, "Chỉ nhận PDF, DOCX, PNG và JPG.")

        # Đọc nhiều hơn giới hạn đúng một byte để phát hiện file quá lớn mà không nạp toàn bộ file.
        content = file.file.read(MAX_FILE_SIZE + 1)

        if not content:
            raise HTTPException(400, "File đang trống.")

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, f"File vượt quá {MAX_FILE_SIZE // (1024 * 1024)} MB.")

        # Lưu file gốc trước để có thể tải lại hoặc lập chỉ mục lại nếu xử lý nội dung gặp lỗi.
        document = upload_to_atlas(
            filename,
            content,
            knowledge_base_id,
        )

        return process_uploaded_document(
            document=document,
            content=content,
        )

    except LookupError:
        raise HTTPException(404, "Không tìm thấy bộ tài liệu.")


    except DocumentBusyError as error:
        raise HTTPException(409, str(error)) from error

    except NoFile:
        raise HTTPException(
            404,
            "File không còn tồn tại.",
        )
    
    except PyMongoError:
        raise HTTPException(503, "Không lưu được dữ liệu lên Atlas.")

    finally:
        file.file.close()

@router.get("", response_model=list[DocumentResponse])
def list_documents(knowledge_base_id: str):
    if not ObjectId.is_valid(knowledge_base_id):
        raise HTTPException(400, "ID bộ tài liệu không hợp lệ.")
    knowledge_base_id = str(ObjectId(knowledge_base_id))

    try:
        find_knowledge_base_by_id(knowledge_base_id)
        return list_atlas_files(knowledge_base_id)
    except LookupError:
        raise HTTPException(404, "Không tìm thấy bộ tài liệu.")
    except PyMongoError:
        raise HTTPException(503, "Không lấy được danh sách file.")

@router.get("/{file_id}/file")
def get_document_file(file_id: str, download: bool = False):
    if not ObjectId.is_valid(file_id):
        raise HTTPException(400, "ID file không hợp lệ.")

    try:
        filename, content = read_from_atlas(file_id)
    except NoFile:
        raise HTTPException(404, "Không tìm thấy file.")
    except PyMongoError:
        raise HTTPException(503, "Không đọc được file từ Atlas.")

    media_type = guess_type(filename)[0] or "application/octet-stream"
    # Tham số download quyết định trình duyệt tải file xuống hay mở trực tiếp.
    disposition = "attachment" if download else "inline"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f"{disposition}; filename*=UTF-8''{quote(filename, safe='')}"
            )
        },
    )

def validate_file_id(file_id: str):
    if not ObjectId.is_valid(file_id):
        raise HTTPException(400, "ID file không hợp lệ.")


def run_document_action(function, *args):
    try:
        return function(*args)

    except NoFile:
        raise HTTPException(404, "Không tìm thấy file.")

    except ValueError as error:
        raise HTTPException(409, str(error))

    except PyMongoError:
        raise HTTPException(
            503,
            "Không thực hiện được thao tác với file trên Atlas.",
        )
    except ChromaError:
        raise HTTPException(
            503,
            "Không thực hiện được thao tác ChromaDB. Hãy thử lại.",
        )
    except DocumentBusyError as error:
        raise HTTPException(409, str(error)) from error
    
@router.get("/{file_id}", response_model=DocumentResponse)
def get_document(file_id: str):
    validate_file_id(file_id)

    return run_document_action(
        get_atlas_file_info,
        file_id,
    )


@router.patch("/{file_id}", response_model=DocumentResponse)
def rename_document(file_id: str, body: DocumentRename):
    validate_file_id(file_id)

    return run_document_action(
        rename_atlas_file,
        file_id,
        body.filename,
    )


@router.delete("/{file_id}", response_model=DocumentDeleteResponse)
def delete_document(file_id: str):
    validate_file_id(file_id)

    return run_document_action(
        delete_atlas_file,
        file_id,
    )

@router.get(
    "/{file_id}/text",
    response_model=DocumentTextResponse | DOCXTextResponse,
)
def get_document_text(file_id: str):
    validate_file_id(file_id)

    try:
        filename, content = read_from_atlas(file_id)
        extension = Path(filename).suffix.lower()

        if extension == ".pdf":
            pages = extract_pdf_text(content)

            return DocumentTextResponse(
                id=file_id,
                filename=filename,
                total_pages=len(pages),
                pages=pages,
            )

        if extension == ".docx":
            blocks = extract_docx_text(content)

            return DOCXTextResponse(
                id=file_id,
                filename=filename,
                total_blocks=len(blocks),
                blocks=blocks,
            )

        raise HTTPException(
            status_code=415,
            detail="Hiện hỗ trợ trích xuất nội dung PDF và DOCX.",
        )

    except NoFile:
        raise HTTPException(404, "Không tìm thấy file.")

    except (PDFParsingError, DOCXParsingError) as error:
        raise HTTPException(422, str(error)) from error

    except PyMongoError:
        raise HTTPException(503, "Không đọc được file từ Atlas.")

@router.post(
    "/{file_id}/reindex",
    response_model=DocumentResponse,
)
def reindex_document_api(file_id: str):
    validate_file_id(file_id)

    return run_document_action(
        reindex_document,
        file_id,
    )

@router.get(
    "/{file_id}/chunks",
    response_model=(
        StoredDocumentChunksResponse
    ),
)
def get_document_chunks_api(
    file_id: str,
):
    validate_file_id(file_id)

    try:
        get_atlas_file_info(file_id)

        # Endpoint này đọc nội dung đoạn văn bản trong document_chunks. Chroma phục vụ tìm theo vector.
        chunks = list_document_chunks(
            file_id
        )

        return StoredDocumentChunksResponse(
            document_id=file_id,
            total_chunks=len(chunks),
            chunks=chunks,
        )

    except NoFile:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy file.",
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Không đọc được chunk "
                "từ MongoDB."
            ),
        )