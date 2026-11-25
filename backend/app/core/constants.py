
import json
from pathlib import Path

_path = Path(__file__).resolve().parents[3] / "shared" / "constants.json"
with _path.open(encoding="utf-8") as _file:
    _constants = json.load(_file)

MAX_FILE_SIZE = _constants["max_file_size_bytes"]
ALLOWED_EXTENSIONS = frozenset(_constants["allowed_extensions"])
CHUNK_SIZE = _constants["chunk_size"]
CHUNK_OVERLAP = _constants["chunk_overlap"]
EMBEDDING_MAX_SEQ_LENGTH = _constants["embedding_max_seq_length"]
CONVERSATION_DEFAULT_TITLE = _constants["conversation_default_title"]
CONVERSATION_TITLE_MAX_LENGTH = _constants["conversation_title_max_length"]
MESSAGE_MAX_LENGTH = _constants["message_max_length"]
CONVERSATION_AUTO_TITLE_LENGTH = _constants["conversation_auto_title_length"]
RETRIEVAL_MAX_DISTANCE = (_constants[ "retrieval_max_distance"])
RETRIEVAL_MIN_TEXT_LENGTH = (_constants["retrieval_min_text_length"])