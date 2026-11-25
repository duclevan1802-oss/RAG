import { useState } from 'react';
import type { Conversation, Attachment } from '../types/chat';
import type { KnowledgeBase } from '../types/document';
import MessageList from '../components/chat/MessageList';
import ChatComposer from '../components/chat/ChatComposer';
import Icon from '../components/Icon';
import { suggestions } from '../mocks/data';
interface Props {
  conversation: Conversation;
  knowledgeBases: KnowledgeBase[];
  onSend: (
    content: string,
    attachments: Attachment[],
    knowledgeBaseId: string,
  ) => void;
  canStop: boolean;
  onStop: () => void;
}

export default function ChatPage({
  conversation,
  knowledgeBases,
  onSend,
  canStop,
  onStop,
}: Props) {
  const [draft, setDraft] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');
  return <div className="chat-page"><header className="topbar"><div><span className="eyebrow">KHÔNG GIAN CÁ NHÂN</span><h2>Trò chuyện</h2></div><span className="model-chip"><span className="dot"/>Qwen3 4B <span className="muted">/ Local</span></span></header>
    <div className="chat-scroll">{conversation.messages.length ? <MessageList messages={conversation.messages}/> : <div className="welcome"><div className="welcome-mark"><Icon name="spark" size={34}/></div><span className="eyebrow">KIẾN THỨC CỦA BẠN, TRONG TẦM TAY</span><h1>Bắt đầu từ một câu hỏi.</h1><p>Khám phá, kết nối và tìm câu trả lời<br/>từ những tài liệu của riêng bạn.</p><div className="suggestions">{suggestions.map((s, i) => <button key={s} onClick={() => setDraft(s)}><Icon name={i === 0 ? 'file' : i === 1 ? 'search' : i === 2 ? 'spark' : 'book'}/><span>{s}</span><span className="suggestion-arrow">↗</span></button>)}</div></div>}</div>
    <div className="chat-bottom"><label className="kb-select"><Icon name="book" size={16}/><span>Nguồn tài liệu</span><select aria-label="Chọn nguồn tài liệu" value={selectedBaseId} onChange={event => setSelectedBaseId(event.target.value)}
><option value="">Tất cả bộ tài liệu</option>{knowledgeBases.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
<ChatComposer
  value={draft}
  canStop={canStop}
  onStop={onStop}
  onChange={setDraft}
  onSend={(content, attachments) => {
    const selectedBase = knowledgeBases.find(
      base => base.id === selectedBaseId,
    );

    if (selectedBaseId && !selectedBase) {
      window.alert('Không tìm thấy bộ tài liệu đã chọn.');
      return;
    }

    if (attachments.length > 0) {
      window.alert('Hãy tải file vào Kho tài liệu trước khi đặt câu hỏi.');
      return;
    }

    onSend(content, attachments, selectedBase?.id ?? '');
  }}
/></div>
  </div>;
}
