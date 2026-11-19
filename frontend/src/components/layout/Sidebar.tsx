import Icon from '../Icon';
import type { Conversation } from '../../types/chat';
interface Props { page: 'chat' | 'documents'; onNavigate: (page: 'chat' | 'documents') => void; conversations: Conversation[]; activeId: string; onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }
export default function Sidebar(p: Props) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Icon name="book" size={24}/></span><div>VIT AI<small>Không gian tri thức</small></div></div>
    <button className="new-chat" onClick={p.onNew}><Icon name="plus"/> Cuộc trò chuyện mới</button>
    <nav aria-label="Điều hướng"><button className={p.page === 'chat' ? 'nav-item active' : 'nav-item'} onClick={() => p.onNavigate('chat')}><Icon name="chat"/>Trò chuyện</button><button className={p.page === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => p.onNavigate('documents')}><Icon name="book"/>Kho tài liệu</button></nav>
    <div className="section-label">CUỘC TRÒ CHUYỆN</div>
    <div className="history">{p.conversations.map(c => <div className={`history-row ${p.activeId === c.id && p.page === 'chat' ? 'selected' : ''}`} key={c.id}><button onClick={() => p.onSelect(c.id)}><Icon name="chat" size={16}/><span>{c.title}</span></button><button className="icon-button" aria-label={`Xóa ${c.title}`} onClick={() => p.onDelete(c.id)}><Icon name="trash" size={14}/></button></div>)}</div>
    <div className="sidebar-footer"><span className="avatar">B</span><div>Không gian cá nhân<small>Phiên dùng thử giao diện</small></div></div>
  </aside>;
}
