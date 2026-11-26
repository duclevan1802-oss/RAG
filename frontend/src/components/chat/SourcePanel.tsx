// Hiển thị các đoạn RAG tìm được và đánh dấu đoạn AI đã dẫn trong câu trả lời.

import type { Source } from '../../types/chat';
import Icon from '../Icon';

export default function SourcePanel({ sources, answer }: { sources: Source[]; answer: string }) {
  if (!sources.length) return null;

  // Đối chiếu nhãn [Nguồn N] trong câu trả lời với các đoạn thực tế hệ thống đã tìm thấy.
  const citationNumbers = new Set(
    Array.from(
      answer.normalize('NFC').matchAll(/\[\s*ngu[ồo]n\s+(\d+)\b[^\[\]\r\n]*\]/giu),
      match => Number(match[1]),
    ),
  );

  return (
    <details className="sources source-panel">
      <summary>
        <Icon name="book" size={16} />
        Nguồn tài liệu ({sources.length})
        <Icon name="chevron" size={16} />
      </summary>
      {sources.map(source => (
        <blockquote key={source.id}>
          {source.number != null && (
            <small className="source-reference">
              Nguồn {source.number} · {citationNumbers.has(source.number) ? 'Được trích dẫn' : 'Tìm được trong kho'}
            </small>
          )}
          <strong>{source.filename}</strong>
          {source.page != null && <span className="source-page">Trang {source.page}</span>}
          <p>{source.excerpt}</p>
        </blockquote>
      ))}
    </details>
  );
}
