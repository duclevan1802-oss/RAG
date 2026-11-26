# VIT AI

Trợ lý chat RAG và quản lý kho tài liệu. Backend và frontend chạy trên máy, còn GPT-OSS 20B tạo câu trả lời qua Groq.

## Công nghệ

- Backend: Python, FastAPI
- GPT-OSS 20B qua Groq, gọi bằng LangChain `ChatGroq`.
- Embedding: Sentence Transformers, AITeamVN/Vietnamese_Embedding
- Vector database: ChromaDB
- MongoDB lưu metadata và lịch sử chat. GridFS lưu file gốc.
- Đọc tài liệu: PyMuPDF, python-docx; ảnh và PDF scan cần OCR
- Frontend: React, TypeScript, Vite

## Cấu trúc

```text
backend/app/
  api/            # Endpoint HTTP
  core/           # Cấu hình môi trường
  db/             # Kết nối MongoDB, ChromaDB
  schemas/        # Schema request/response
  services/       # Embedding, truy xuất tài liệu, gọi Groq
    parsers/      # Bộ đọc PDF, DOCX
  workers/        # Tiến trình nạp tài liệu
frontend/src/
  components/     # Thành phần giao diện dùng chung
  pages/          # Chat, kho tài liệu
  services/       # Gọi backend
  types/          # Kiểu dữ liệu
storage/
  chroma/         # Dữ liệu vector local
```

## Chạy backend (PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Điền `MONGODB_URI` và `GROQ_API_KEY` trong `backend/.env`. Model mặc định là `openai/gpt-oss-20b`. Nếu đã có `.env`, cập nhật trực tiếp các biến cần thiết.

```powershell
uvicorn app.main:app --reload
```

API: http://localhost:8000/health · Swagger: http://localhost:8000/docs

## Chạy frontend

```powershell
cd frontend
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Frontend: http://localhost:5173

## Khởi động và thử chat

Sau khi cài thư viện và điền cấu hình, chạy `.\start.ps1` từ thư mục gốc để mở cả frontend và backend.

1. Gọi `POST /api/chat` trong Swagger để kiểm tra kết nối Groq.
2. Mở VIT AI, chọn một bộ tài liệu đã được xử lý và hỏi một câu có đáp án trong tài liệu để kiểm tra streaming và nguồn tham khảo.
