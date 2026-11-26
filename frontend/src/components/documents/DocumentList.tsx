import type { Document } from '../../types/document';
import DocumentStatus from './DocumentStatus';
import Icon from '../Icon';

function formatSize(size: number) {
  const mb = 1024 * 1024;
  return size < mb ? Math.max(1, Math.round(size / 1024)) + ' KB' : (size / mb).toFixed(1) + ' MB';
}

export default function DocumentList({ documents, onDelete }: { documents: Document[]; onDelete: (id: string) => void }) {
  if (!documents.length) return (
    <div className="empty-docs">
      <span className="folder-icon"><Icon name="file" size={23} /></span>
      <h3>Chưa có tài liệu</h3>
      <p>Chọn một tệp ở phía trên để thêm vào bộ này.</p>
    </div>
  );

  return (
    <div className="table-scroll">
      <table aria-label="Tài liệu trong bộ">
        <thead>
          <tr>
            <th scope="col">Tên tài liệu</th>
            <th scope="col">Dung lượng</th>
            <th scope="col">Trạng thái</th>
            <th scope="col"><span className="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map(document => (
            <tr key={document.id}>
              <td className="document-name-cell">
                <div className="file-name">
                  <span className="file-icon"><Icon name="file" size={18} /></span>
                  <span>{document.filename}</span>
                </div>
                {document.error && <small className="document-error">{document.error}</small>}
              </td>
              <td className="document-size">{formatSize(document.size)}</td>
              <td><DocumentStatus status={document.status} /></td>
              <td>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={'Xóa ' + document.filename}
                  onClick={() => onDelete(document.id)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
