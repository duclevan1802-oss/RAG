import type { Source } from '../../types/chat';
export default function SourcePanel({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return <details className="sources"><summary>{sources.length} nguồn tham khảo</summary>{sources.map(s => <blockquote key={s.id}><strong>{s.filename}{s.page ? ` · Trang ${s.page}` : ''}</strong><p>{s.excerpt}</p></blockquote>)}</details>;
}
