# Frontend VIT AI

React + TypeScript + Vite. Giao diện tiếng Việt gồm chat, đính kèm file, tạo bộ tài liệu, danh sách và trang chi tiết tài liệu.

```powershell
cd "C:\VIT AI\frontend"
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Mở http://localhost:5173. Build production: `npm run build`.

## Cấu trúc

- `components/layout`: thanh điều hướng, lịch sử hội thoại.
- `components/chat`: tin nhắn, ô nhập, file đính kèm, nguồn tham khảo.
- `components/documents`: chọn/kéo thả file, danh sách và trạng thái.
- `pages`: chat, kho tài liệu và chi tiết bộ tài liệu.
- `types`: kiểu dữ liệu dùng chung.
- `mocks/data.ts`: dữ liệu mẫu.
- `services/api.ts`: địa chỉ API và kiểm tra `/health`.

## Kết nối backend

Frontend gọi FastAPI để tải lịch sử và quản lý kho tài liệu. Khi gửi câu hỏi, giao diện nhận nội dung streaming và nguồn tham khảo từ API RAG. Backend gọi GPT-OSS 20B qua Groq. Đặt `GROQ_API_KEY` trong `backend/.env`.

`/health` kiểm tra tiến trình FastAPI. Để kiểm tra model, gửi một câu hỏi qua giao diện hoặc gọi `POST /api/chat` trong Swagger.
