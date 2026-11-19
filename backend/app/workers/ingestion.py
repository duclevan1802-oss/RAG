import logging
from pathlib import Path

from app.schemas.document import (
    DOCXTextResponse,
    DocumentResponse,
    DocumentTextResponse,
)
from app.services.chunking import create_document_chunks
from app.services.embeddings import create_embeddings
from app.services.parsers.docx import DOCXParsingError, extract_docx_text
from app.services.parsers.pdf import PDFParsingError, extract_pdf_text
from app.repositories.documents import get_atlas_file_info, update_document_state
from app.services.vector_store import (
    delete_document_chunks,
    save_document_chunks,
)
from app.core.document_operations import (
    DocumentBusyError,
    document_operation,
)
from app.services.storage import read_from_atlas

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    pass


def _process_uploaded_document(
    document: DocumentResponse,
    content: bytes,
) -> DocumentResponse:
    update_document_state(document.id, "processing")

    try:
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
            raise IngestionError(
                "Chưa hỗ trợ tự động xử lý loại file này. Ảnh cần OCR."
            )

        chunked_document = create_document_chunks(text_document)

        if not chunked_document.chunks:
            raise IngestionError(
                "Không trích xuất được chữ. Tài liệu scan có thể cần OCR."
            )

        texts = [
            chunk.text
            for chunk in chunked_document.chunks
        ]

        embeddings = create_embeddings(texts)

        delete_document_chunks(document.id)

        count = save_document_chunks(
            document=chunked_document,
            embeddings=embeddings,
            knowledge_base_id=document.knowledge_base_id,
        )

        update_document_state(
            file_id=document.id,
            status="ready",
            chunk_count=count,
        )

        return document.model_copy(
            update={
                "status": "ready",
                "chunk_count": count,
                "error": None,
            }
        )

    except Exception as error:
        logger.exception(
            "Document processing failed: %s",
            document.id,
        )

        try:
            delete_document_chunks(document.id)
        except Exception:
            logger.exception(
                "Could not clean partial vectors: %s",
                document.id,
            )

        if isinstance(
            error,
            (IngestionError, PDFParsingError, DOCXParsingError),
        ):
            message = str(error)
        else:
            message = "Xử lý tài liệu thất bại. Kiểm tra log backend."

        update_document_state(
            file_id=document.id,
            status="failed",
            error=message,
        )

        return document.model_copy(
            update={
                "status": "failed",
                "chunk_count": 0,
                "error": message,
            }
        )

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
