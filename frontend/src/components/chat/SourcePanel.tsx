import type { Source } from '../../types/chat';
import Icon from '../Icon';

export default function SourcePanel({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <details className="sources source-panel">
      <summary>
        <Icon name="book" size={16} />
        {sources.length} đoạn tham khảo
        <Icon name="chevron" size={16} />
      </summary>
      {sources.map(source => (
        <blockquote key={source.id}>
          <strong>{source.filename}</strong>
          {source.page != null && <span className="source-page">Trang {source.page}</span>}
          <p>{source.excerpt}</p>
        </blockquote>
      ))}
    </details>
  );
}
