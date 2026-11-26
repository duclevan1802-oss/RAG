# Đọc đoạn văn và nội dung bảng DOCX theo thứ tự xuất hiện trong file.

from io import BytesIO
from zipfile import BadZipFile

from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from docx.table import Table
from docx.text.paragraph import Paragraph
from lxml.etree import XMLSyntaxError

from app.schemas.document import DocumentTextBlock


class DOCXParsingError(Exception):
    pass


def extract_docx_text(content: bytes) -> list[DocumentTextBlock]:
    try:
        document = Document(BytesIO(content))
        blocks = []

        for item in document.iter_inner_content():
            if isinstance(item, Paragraph):
                text = item.text.strip()
                kind = "paragraph"

            elif isinstance(item, Table):
                rows = [
                    "\t".join(cell.text.strip() for cell in row.cells)
                    for row in item.rows
                ]

                text = "\n".join(rows).strip()
                kind = "table"

            else:
                continue

            blocks.append(
                DocumentTextBlock(
                    block_number=len(blocks) + 1,
                    kind=kind,
                    text=text,
                    has_text=bool(text),
                )
            )

        return blocks

    except (
        BadZipFile,
        PackageNotFoundError,
        XMLSyntaxError,
        KeyError,
        OSError,
        ValueError,
    ) as error:
        raise DOCXParsingError(
            "Không đọc được DOCX. File có thể bị hỏng hoặc sai định dạng."
        ) from error