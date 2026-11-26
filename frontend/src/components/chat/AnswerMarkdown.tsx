// Hiển thị Markdown của câu trả lời AI, gồm bảng, liên kết và khối mã.

import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];
// Chặn ảnh từ nội dung model để trình duyệt không tự tải tài nguyên nhúng bên ngoài.
const disallowedElements = ['img'];

// Gắn kiểu liên kết an toàn và cho phép cuộn riêng bảng hoặc khối mã dài.
const components: Components = {
  a({ href, children }) {
    if (!href || !/^https?:\/\//i.test(href)) return <>{children}</>;
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  pre({ children }) {
    return <pre tabIndex={0} aria-label="Khối mã">{children}</pre>;
  },
  table({ children }) {
    return (
      <div className="markdown-table" role="region" aria-label="Bảng trong câu trả lời" tabIndex={0}>
        <table>{children}</table>
      </div>
    );
  },
};

export default function AnswerMarkdown({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className={`message-text answer-markdown${streaming ? ' is-streaming' : ''}`}>
      <Markdown skipHtml disallowedElements={disallowedElements} remarkPlugins={plugins} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
