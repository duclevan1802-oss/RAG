# RAG Local

Khung dự án chat và quản lý kho tài liệu chạy local.

## Công nghệ

- Backend: Python, FastAPI
- LLM: Qwen3 4B qua Ollama
- Embedding: Sentence Transformers, AITeamVN/Vietnamese_Embedding
- Vector database: ChromaDB
- Metadata và lịch sử chat: MongoDB
- Đọc tài liệu: PyMuPDF, python-docx; ảnh và PDF scan cần OCR
- Frontend: React, TypeScript, Vite

## Cấu trúc

```text
backend/app/
  api/            # Endpoint HTTP
  core/           # Cấu hình môi trường
  db/             # Kết nối MongoDB, ChromaDB
  schemas/        # Schema request/response
  services/       # Embedding, retrieval, OCR, Ollama
    parsers/      # Bộ đọc PDF, DOCX
  workers/        # Tiến trình nạp tài liệu
frontend/src/
  components/     # Thành phần giao diện dùng chung
  pages/          # Chat, kho tài liệu
  services/       # Gọi backend
  types/          # Kiểu dữ liệu
storage/
  uploads/        # File gốc
  chroma/         # Dữ liệu vector local
```

## Chạy khung backend (PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

API: http://localhost:8000/health · Swagger: http://localhost:8000/docs

`requirements.txt` chứa gói cho khung FastAPI. Các gói dự kiến dùng cho RAG nằm trong `requirements-rag.txt` và được cài khi triển khai phần tương ứng.

## Chạy khung frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend: http://localhost:5173

## Những phần cần triển khai tiếp

1. Kết nối MongoDB và ChromaDB.
2. Upload, lưu file, metadata, và trạng thái xử lý.
3. Parse PDF/DOCX, OCR ảnh, chia đoạn và embedding.
4. Retrieval theo phạm vi kho tài liệu hoặc hội thoại.
5. Chat streaming qua Ollama, lưu lịch sử và trích dẫn nguồn.
6. Giao diện quản lý tài liệu và đính kèm file trong chat.

Hiện tại đây là cấu trúc ban đầu có API health và giao diện tĩnh; chưa có tính năng RAG, upload hay chat thực tế. Chưa cài dependency hoặc chạy kiểm tra.
