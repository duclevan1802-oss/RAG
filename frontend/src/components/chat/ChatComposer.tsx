import { useRef, useState } from 'react';
import type { Attachment } from '../../types/chat';
import AttachmentList from './AttachmentList';
import Icon from '../Icon';
import constants from '../../../../shared/constants.json';
interface Props { value: string; onChange: (value: string) => void; onSend: (content: string, attachments: Attachment[]) => void; canStop: boolean; onStop: () => void;  }
export default function ChatComposer({
  value,
  onChange,
  onSend,
  canStop,
  onStop,
}: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  function send() {
  if (canStop) return;
  if (!value.trim() && !attachments.length) return;

  onSend(value.trim(), attachments);
  onChange('');
  setAttachments([]);
}
  return <div className="composer-wrap"><form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
    <AttachmentList attachments={attachments} onRemove={id => setAttachments(items => items.filter(a => a.id !== id))}/>
    <textarea aria-label="Câu hỏi" placeholder="Hỏi bất cứ điều gì về tài liệu của bạn…" rows={2} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}/>
    <div className="composer-tools"><button type="button" className="attach-button" onClick={() => input.current?.click()}><Icon name="clip" size={18}/>Đính kèm</button><span className="composer-hint">PDF, DOCX, ảnh · Tối đa {constants.max_file_size_bytes / 1024 / 1024} MB/file</span>
    {canStop ? (
      <button
        key="stop"
        className="send-button"
        type="button"
        onClick={onStop}
        aria-label="Dừng tạo"
        title="Dừng tạo"
      >
        <span aria-hidden="true">■</span>
      </button>
    ) : (
      <button
        key="send"
        className="send-button"
        type="button"
        onClick={send}
        disabled={!value.trim() && !attachments.length}
        aria-label="Gửi câu hỏi"
      >
        <Icon name="arrow" />
      </button>
    )}</div>
    <input ref={input} hidden type="file" multiple accept=".pdf,.docx,image/*" onChange={e => { const files = Array.from(e.target.files ?? []); setError(files.some(f => f.size > constants.max_file_size_bytes) ? `Một số file vượt quá ${constants.max_file_size_bytes / 1024 / 1024} MB và chưa được chọn.` : ''); setAttachments(old => [...old, ...files.filter(f => f.size <= constants.max_file_size_bytes).map(f => ({ id: crypto.randomUUID(), filename: f.name }))]); e.target.value = ''; }}/>
  </form>{error && <p className="error" role="alert">{error}</p>}<p className="composer-note">Chế độ giao diện mẫu · File đính kèm chưa được tải lên máy chủ.</p></div>;
}
