# RAG Local — Frontend

React + TypeScript + Vite. Giao diện tiếng Việt gồm chat, đính kèm file, tạo bộ tài liệu, danh sách và trang chi tiết tài liệu.

```powershell
cd "C:\VIT AI\frontend"
npm install
Copy-Item .env.example .env
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

## Phạm vi hiện tại

Giao diện chạy với dữ liệu trong bộ nhớ; tải lại trang sẽ mất thay đổi. Có thể tạo/chuyển/xóa hội thoại, gửi tin nhắn thử, chọn file, tạo bộ tài liệu và xóa file khỏi danh sách tạm. File thực chưa được tải lên hoặc đọc nội dung. Tin nhắn trợ lý thông báo rõ đây là bản thử, chưa gọi LLM. Việc chọn kho trong chat hiện chỉ là giao diện.

API health chỉ kiểm tra tiến trình FastAPI, không chứng minh Ollama hoặc RAG đang hoạt động. Cần nối các API upload, quản lý tài liệu và chat ở bước backend. Font Google là tùy chọn; khi offline dùng font hệ thống.
