# Thực hiện trích xuất, chia đoạn, tạo embedding và cập nhật chỉ mục của tài liệu.

import logging
from pathlib import Path

from bson import ObjectId
from gridfs.errors import NoFile
from pymongo.errors import PyMongoError

from app.schemas.document import (
    DOCXTextResponse,
    DocumentChunksResponse,
    DocumentResponse,
    DocumentTextResponse,
)
from app.services.chunking import create_document_chunks
from app.services.embeddings import create_embeddings
from app.services.parsers.docx import DOCXParsingError, extract_docx_text
from app.services.parsers.pdf import PDFParsingError, extract_pdf_text
from app.repositories.documents import get_atlas_file_info, update_document_state
from app.services.vector_store import (
    delete_document_index,
    save_document_chunks,
)
from app.core.document_operations import (
    DocumentBusyError,
    document_operation,
)
from app.services.storage import read_from_atlas
from app.repositories.document_chunks import publish_document_index

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    pass


def _chunk_uploaded_document(
    document: DocumentResponse,
    content: bytes,
) -> DocumentChunksResponse:
    extension = Path(document.filename).suffix.lower()
    if extension == ".pdf":
        pages = extract_pdf_text(content)
        text_document = DocumentTextResponse(
            id=document.id,
            filename=document.filename,
            total_pages=len(pages),
            pages=pages,
        )
    elif extension == ".docx":
        blocks = extract_docx_text(content)
        text_document = DOCXTextResponse(
            id=document.id,
            filename=document.filename,
            total_blocks=len(blocks),
            blocks=blocks,
        )
    else:
        raise IngestionError("Chưa hỗ trợ tự động xử lý loại file này. Ảnh cần OCR.")

    chunked = create_document_chunks(text_document)
    if not chunked.chunks:
        raise IngestionError("Không trích xuất được chữ. Tài liệu scan có thể cần OCR.")
    return chunked


def _discard_index(file_id: str, index_version: str | None) -> None:
    try:
        delete_document_index(file_id, index_version)
    except Exception:
        logger.exception("Không dọn được chỉ mục %s của file %s", index_version, file_id)


def _process_uploaded_document(
    document: DocumentResponse,
    content: bytes,
) -> DocumentResponse:
    # File đã sẵn sàng giữ trạng thái ready để RAG tiếp tục lấy nguồn cũ trong lúc xây bản mới.
    if document.status != "ready":
        document = update_document_state(document, status="processing")

    # Mỗi lần xử lý dùng một mã riêng để vector mới nằm cạnh vector cũ trong giai đoạn chuẩn bị.
    index_version = str(ObjectId())
    storing_vectors = False
    publishing = False

    try:
        chunked = _chunk_uploaded_document(document, content)
        embeddings = create_embeddings([chunk.text for chunk in chunked.chunks])
        storing_vectors = True
        count = save_document_chunks(
            document=chunked,
            embeddings=embeddings,
            knowledge_base_id=document.knowledge_base_id,
            index_version=index_version,
        )
        # Chỉ được chuyển sang chỉ mục mới sau khi số vector khớp số đoạn văn bản.
        if count != len(chunked.chunks):
            raise IngestionError("ChromaDB chưa lưu đủ các đoạn của chỉ mục mới.")
        publishing = True
        ready = publish_document_index(document, chunked, index_version)
    except Exception as error:
        logger.exception("Document processing failed: %s", document.id)
        if publishing and not isinstance(error, DocumentBusyError):
            # A failed commit acknowledgement may mean the index is already active.
            try:
                current = get_atlas_file_info(document.id)
            except NoFile:
                _discard_index(document.id, index_version)
                raise
            if current.active_index_version == index_version:
                _discard_index(document.id, document.active_index_version)
                return current
            if isinstance(error, PyMongoError) and error.has_error_label("UnknownTransactionCommitResult"):
                raise

        # Nếu phiên bản mới thất bại, chỉ dọn vector tạo trong lần xử lý này.
        if storing_vectors:
            _discard_index(document.id, index_version)
        if isinstance(error, DocumentBusyError):
            raise

        message = (
            str(error) if isinstance(error, (IngestionError, PDFParsingError, DOCXParsingError))
            else "Xử lý tài liệu thất bại. Kiểm tra log backend."
        )
        if document.status == "ready":
            return update_document_state(
                document,
                status="ready",
                chunk_count=document.chunk_count,
                error=f"Lập chỉ mục lại thất bại. Vẫn dùng chỉ mục cũ. {message}",
            )
        return update_document_state(document, status="failed", error=message)

    _discard_index(document.id, document.active_index_version)
    return ready

def process_uploaded_document(
    document: DocumentResponse,
    content: bytes,
) -> DocumentResponse:
    with document_operation(document.id):
        current = get_atlas_file_info(document.id)

        if current.status == "deleting":
            raise DocumentBusyError(
                "File đang ở trạng thái xóa. Hãy hoàn tất xóa trước."
            )

        return _process_uploaded_document(
            document=current,
            content=content,
        )

def reindex_document(file_id: str) -> DocumentResponse:
    with document_operation(file_id):
        document = get_atlas_file_info(file_id)

        if document.status == "deleting":
            raise DocumentBusyError(
                "File đang ở trạng thái xóa. Hãy hoàn tất xóa trước."
            )

        _, content = read_from_atlas(document.id)

        return _process_uploaded_document(
            document=document,
            content=content,
        )
