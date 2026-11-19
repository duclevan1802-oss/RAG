from app.core.constants import CHUNK_OVERLAP, CHUNK_SIZE
from app.schemas.document import (
    DOCXTextResponse,
    DocumentChunk,
    DocumentChunksResponse,
    DocumentTextResponse,
)


def split_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size phải lớn hơn 0.")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap phải từ 0 đến nhỏ hơn chunk_size.")

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        part = text[start:end]

        if part.strip():
            chunks.append(part)

        if end == len(text):
            break

        start = end - overlap

    return chunks

def create_document_chunks(
    document: DocumentTextResponse | DOCXTextResponse,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> DocumentChunksResponse:
    if chunk_size <= 0 or not 0 <= overlap < chunk_size:
        raise ValueError("Thông số chia đoạn không hợp lệ.")

    if isinstance(document, DocumentTextResponse):
        sources = [
            (page.text, page.page_number, None)
            for page in document.pages
        ]
    else:
        sources = [
            (block.text, None, block.block_number)
            for block in document.blocks
        ]

    chunks = []

    for text, page_number, block_number in sources:
        parts = split_text(
            text=text,
            chunk_size=chunk_size,
            overlap=overlap,
        )

        for part in parts:
            chunks.append(
                DocumentChunk(
                    chunk_number=len(chunks) + 1,
                    text=part,
                    page_number=page_number,
                    block_number=block_number,
                )
            )

    return DocumentChunksResponse(
        id=document.id,
        filename=document.filename,
        chunk_size=chunk_size,
        overlap=overlap,
        total_chunks=len(chunks),
        chunks=chunks,
    )
