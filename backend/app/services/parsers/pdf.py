import pymupdf

from app.schemas.document import DocumentPageText


class PDFParsingError(Exception):
    pass


def extract_pdf_text(content: bytes) -> list[DocumentPageText]:
    try:
        with pymupdf.open(stream=content, filetype="pdf") as document:
            if not document.is_pdf:
                raise PDFParsingError("Nội dung file không phải PDF.")

            if document.needs_pass:
                raise PDFParsingError(
                    "PDF được bảo vệ bằng mật khẩu, chưa thể đọc."
                )

            pages = []

            for index, page in enumerate(document):
                text = page.get_text("text", sort=True).strip()

                pages.append(
                    DocumentPageText(
                        page_number=index + 1,
                        text=text,
                        has_text=bool(text),
                    )
                )

            return pages

    except (RuntimeError, ValueError) as error:
        raise PDFParsingError(
            "Không đọc được PDF. File có thể bị hỏng hoặc sai định dạng."
        ) from error