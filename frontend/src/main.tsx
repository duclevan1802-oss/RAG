// Gắn ứng dụng React vào phần tử root của index.html và nạp CSS toàn dự án.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
