import type { Attachment } from '../../types/chat';
import Icon from '../Icon';
export default function AttachmentList({ attachments, onRemove }: { attachments: Attachment[]; onRemove?: (id: string) => void }) {
  return <div className="attachments">{attachments.map(a => <span className="attachment" key={a.id}><Icon name="file" size={16}/>{a.filename}{onRemove && <button className="icon-button" aria-label={`Bỏ ${a.filename}`} onClick={() => onRemove(a.id)}><Icon name="close" size={14}/></button>}</span>)}</div>;
}
