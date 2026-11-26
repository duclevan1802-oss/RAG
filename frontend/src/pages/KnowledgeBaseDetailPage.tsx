import type { KnowledgeBase, DocumentListState } from '../types/document';
import UploadZone from '../components/documents/UploadZone';
import DocumentList from '../components/documents/DocumentList';
import Icon from '../components/Icon';

interface Props {
  knowledgeBase: KnowledgeBase;
  documentList?: DocumentListState;
  uploading: boolean;
  onBack: () => void;
  onRetry: () => void;
  onAdd: (files: File[]) => void;
  onDelete: (id: string) => void;
}

export default function KnowledgeBaseDetailPage({
  knowledgeBase, documentList, uploading, onBack, onRetry, onAdd, onDelete,
}: Props) {
  return (
    <section className="documents-page">
      <header className="topbar">
        <button className="back-button" type="button" onClick={onBack}>
          <Icon name="back" size={18} /> Kho tài liệu
        </button>
      </header>

      <div className="page-content">
        <div className="collection-intro">
          <span className="folder-icon"><Icon name="folder" size={28} /></span>
          <div className="page-intro">
            <h1>{knowledgeBase.name}</h1>
            {knowledgeBase.description && <p>{knowledgeBase.description}</p>}
          </div>
        </div>
        {documentList?.status === 'loaded' ? (
          <>
            <UploadZone onSelect={onAdd} uploading={uploading} />
            <div className="list-heading">
              <h2>Tài liệu trong bộ</h2>
              <span>{documentList.files.length} tài liệu</span>
            </div>
            <DocumentList documents={documentList.files} onDelete={onDelete} />
          </>
        ) : documentList?.status === 'error' ? (
          <div className="chat-load-state">
            <p role="alert">Không tải được danh sách tài liệu.</p>
            <button type="button" className="secondary" onClick={onRetry}>Thử lại</button>
          </div>
        ) : (
          <div className="chat-load-state" role="status">
            <span className="status-spinner" />
            <p>Đang tải danh sách tài liệu…</p>
          </div>
        )}
      </div>
    </section>
  );
}
