import type { KnowledgeBase, Document } from '../types/document';
import UploadZone from '../components/documents/UploadZone';
import DocumentList from '../components/documents/DocumentList';
import Icon from '../components/Icon';
interface Props { knowledgeBase: KnowledgeBase; documents: Document[]; onBack: () => void; onAdd: (files: File[]) => void; onDelete: (id: string) => void }
export default function KnowledgeBaseDetailPage(p: Props) {
  return <div className="documents-page"><header className="topbar"><button className="back-button" onClick={p.onBack}><Icon name="back" size={18}/>Kho tài liệu</button><span className="model-chip">Bộ tài liệu cá nhân</span></header><div className="page-content"><div className="page-intro"><h1>{p.knowledgeBase.name}</h1><p>{p.knowledgeBase.description}</p></div><div className="info-banner"><Icon name="file"/><span>PDF và DOCX sẽ được tải lên và xử lý để phục vụ tìm kiếm.</span></div><UploadZone onSelect={p.onAdd}/><div className="list-heading"><h3>Tài liệu trong bộ</h3><span>{p.documents.length} tài liệu</span></div><DocumentList documents={p.documents} onDelete={p.onDelete}/></div></div>;
}
