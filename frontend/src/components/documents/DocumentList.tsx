import type { Document } from '../../types/document';
import DocumentStatus from './DocumentStatus';
import Icon from '../Icon';
export default function DocumentList({ documents, onDelete }: { documents: Document[]; onDelete: (id: string) => void }) {
  if (!documents.length) return <div className="empty-docs"><Icon name="file" size={32}/><h3>Chưa có tài liệu</h3><p>Chọn file để thêm vào danh sách thử nghiệm.</p></div>;
  return <div className="table-scroll"><table><thead><tr><th>Tên tài liệu</th><th>Dung lượng</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{documents.map(d => <tr key={d.id}><td><span className="file-name"><Icon name="file"/>{d.filename}</span>{d.error && <small className="document-error">{d.error}</small>}</td><td>{d.size < 1024 * 1024 ? `${Math.max(1, Math.round(d.size / 1024))} KB` : `${(d.size / 1024 / 1024).toFixed(1)} MB`}</td><td><DocumentStatus status={d.status}/></td><td><button className="icon-button danger" aria-label={`Xóa ${d.filename}`} onClick={() => onDelete(d.id)}><Icon name="trash" size={17}/></button></td></tr>)}</tbody></table></div>;
}
