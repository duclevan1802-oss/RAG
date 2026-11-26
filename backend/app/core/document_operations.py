# Điều phối các thao tác ghi trên cùng một file trong một tiến trình backend.

from contextlib import contextmanager
from threading import Lock

from bson import ObjectId


_guard = Lock()
_active_documents: set[str] = set()


class DocumentBusyError(Exception):
    pass


@contextmanager
def document_operation(file_id: str):
    # Chuẩn hóa ID trước khi khóa để mọi cách viết của cùng ObjectId dùng một khóa.
    key = str(ObjectId(file_id))

    with _guard:
        if key in _active_documents:
            raise DocumentBusyError(
                "File đang được xử lý hoặc xóa. Hãy thử lại sau."
            )

        _active_documents.add(key)

    try:
        yield

    finally:
        with _guard:
            _active_documents.discard(key)