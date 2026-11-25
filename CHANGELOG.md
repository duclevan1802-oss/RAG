# Nhật ký thay đổi VIT AI

## 2026-11-25 — Hội thoại, streaming và tìm nguồn RAG

### Frontend

- `frontend/src/App.tsx`: Giữ hội thoại mới dưới dạng bản nháp đến khi gửi câu đầu. Tải tin nhắn khi mở từng hội thoại, giữ kết quả trong bộ nhớ và xử lý dừng stream.
- `frontend/src/components/chat/ChatComposer.tsx`: Đổi nút Gửi thành nút Dừng tạo khi AI đang trả lời. Giữ bản nháp khi người dùng nhấn Enter trong lúc stream.
- `frontend/src/components/chat/MessageList.tsx`: Dùng ID của câu hỏi để React nhận diện ổn định ô trả lời trong lúc stream và sau khi lưu.
- `frontend/src/components/layout/Sidebar.tsx`: Hỗ trợ hiển thị, chọn và xóa bản nháp chưa có ID từ backend.
- `frontend/src/pages/ChatPage.tsx`: Truyền trạng thái và thao tác Dừng tạo xuống ô nhập.
- `frontend/src/services/api.ts`: Gửi ID hội thoại và ID tin nhắn hiện tại khi gọi RAG streaming. Hỗ trợ hủy request bằng `AbortSignal`.
- `frontend/src/types/chat.ts`: Bổ sung kiểu ID có thể là `null`, `replyToMessageId` và trạng thái tải tin nhắn.

### Backend — Hội thoại và RAG

- `backend/app/repositories/conversations.py`: Tạo hội thoại và lưu tin nhắn đầu tiên trong cùng một transaction. Lưu liên kết tin nhắn bằng `ObjectId` và lấy tối đa 10 tin gần nhất làm ngữ cảnh.
- `backend/app/schemas/chat.py`: Bổ sung `conversation_id` và `current_message_id` cho request RAG.
- `backend/app/api/routes/chat.py`: Lấy lịch sử trong luồng streaming, chuẩn bị câu tìm nguồn theo ngữ cảnh và chuyển lịch sử sang Ollama.
- `backend/app/services/ollama.py`: Gửi lịch sử cùng câu hỏi hiện tại cho Qwen và phân biệt sự kiện thinking, nội dung và kết thúc.
- `backend/app/services/rag.py`: Bổ sung prompt trả lời khi không có nguồn, nhận diện câu chào và nối chủ đề vào câu hỏi tiếp theo.
- `backend/app/services/retrieval.py`: Lọc nguồn theo khoảng cách và độ dài, đồng thời đối chiếu ID bộ tài liệu trong MongoDB.
- `backend/app/core/constants.py` và `shared/constants.json`: Khai báo ngưỡng khoảng cách `0.65` và độ dài tối thiểu `80` ký tự.

### Backend — Kho tài liệu

- `backend/app/repositories/document_chunks.py`: Thêm chức năng lưu, đọc và xóa nội dung chunk trong MongoDB.
- `backend/app/schemas/document.py` và `backend/app/api/routes/documents.py`: Thêm schema phản hồi và API `GET /api/documents/{file_id}/chunks`.
- `backend/app/workers/ingestion.py`: Lưu chunk trong MongoDB, lưu vector trong Chroma và kiểm tra số lượng giữa hai nơi.
- `backend/app/services/storage.py`: Lưu ID bộ tài liệu dạng `ObjectId` trong GridFS và dọn chunk MongoDB, vector Chroma khi xóa file.
- `backend/app/repositories/documents.py`: Dùng chung bộ lọc file theo ID bộ tài liệu.
- `backend/app/repositories/knowledge_bases.py` và `backend/app/schemas/knowledge_base.py`: Trả thêm `document_count` trong API danh sách bộ tài liệu.

### Cấu hình Git

- `.gitignore`: Bỏ qua thư mục `.agents/skills/` để giữ skill trên máy cá nhân.