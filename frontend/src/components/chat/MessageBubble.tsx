import type { Message } from '../../types/chat';
import AttachmentList from './AttachmentList';
import SourcePanel from './SourcePanel';
import Icon from '../Icon';
export default function MessageBubble({ message }: { message: Message }) {
  return <article className={`message ${message.role}`}><span className={`message-avatar ${message.role}`}>{message.role === 'user' ? 'B' : <Icon name="spark" size={18}/>}</span><div className="message-body"><strong>{message.role === 'user' ? 'Bạn' : 'VIT AI'}</strong>{message.thinking && <details className="sources"><summary>Quá trình suy nghĩ{message.streaming ? '…' : ''}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{message.thinking}</p></details>}<p style={{ whiteSpace: 'pre-wrap' }}>{message.content || (message.streaming ? 'Đang xử lý…' : '')}</p><AttachmentList attachments={message.attachments ?? []}/><SourcePanel sources={message.sources ?? []}/></div></article>;
}
