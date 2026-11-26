// Cấu hình React cho Vite, cổng chạy giao diện và quyền đọc thư mục dùng chung.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true, fs: { allow: ['..'] } } });
