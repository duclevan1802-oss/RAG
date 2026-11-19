import { useState } from 'react';
import type { KnowledgeBase, Document } from '../types/document';
import Icon from '../components/Icon';
interface Props { knowledgeBases: KnowledgeBase[]; documents: Document[]; onOpen: (id: string) => void; onCreate: (name: string) => void }
export default function KnowledgeBasePage(p: Props) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  return <div className="documents-page"><header className="topbar"><div><span className="eyebrow">KHÔNG GIAN CÁ NHÂN</span><h2>Kho tài liệu</h2></div><button className="primary" onClick={() => setCreating(true)}><Icon name="plus" size={18}/>Tạo bộ tài liệu</button></header><div className="page-content"><div className="page-intro"><h1>Mọi kiến thức, một nơi lưu giữ.</h1><p>Sắp xếp tài liệu thành từng bộ để dễ dàng tra cứu khi trò chuyện.</p></div><div className="info-banner"><Icon name="book"/><span>Bộ tài liệu được lưu trên MongoDB Atlas.</span></div><label className="search-box"><Icon name="search" size={18}/><input placeholder="Tìm bộ tài liệu…" aria-label="Tìm bộ tài liệu" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="kb-grid">{p.knowledgeBases.filter(k => k.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map(k => <button className="kb-card" key={k.id} onClick={() => p.onOpen(k.id)}><span className="folder-icon"><Icon name="book" size={24}/></span><h3>{k.name}</h3><p>{k.description}</p><footer><span>{p.documents.filter(d => d.knowledgeBaseId === k.id).length} tài liệu</span><span>↗</span></footer></button>)}</div>{!p.knowledgeBases.some(k => k.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) && <p>Không tìm thấy bộ tài liệu phù hợp.</p>}</div>
  {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}>
  <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setCreating(false); }}>
    <h2 id="create-title">Tạo bộ tài liệu</h2>
    <p>Đặt tên để dễ tìm lại nguồn kiến thức của bạn.</p>
    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; p.onCreate(name.trim()); setName(''); setCreating(false); }}>
    <label>Tên bộ tài liệu<input autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} required placeholder="Ví dụ: Tài liệu dự án"/>
    </label><div className="modal-actions"><button type="button" className="secondary" onClick={() => setCreating(false)}>Hủy</button>
    <button className="primary" disabled={!name.trim()}>Tạo bộ tài liệu</button></div></form></section></div>}</div>;
}
