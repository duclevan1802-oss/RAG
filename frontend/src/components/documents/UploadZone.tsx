import { useRef, useState } from 'react';
import Icon from '../Icon';
import constants from '../../../../shared/constants.json';

const maxSizeMb = constants.max_file_size_bytes / 1024 / 1024;

export default function UploadZone({
  onSelect, uploading,
}: { onSelect: (files: File[]) => void; uploading: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  function select(files: File[]) {
    if (uploading) return;

    const valid = files.filter(file =>
      constants.allowed_extensions.some(extension => file.name.toLowerCase().endsWith(extension)) &&
      file.size <= constants.max_file_size_bytes,
    );
    setError(valid.length < files.length
      ? 'Chỉ nhận PDF, DOCX, PNG hoặc JPG, tối đa ' + maxSizeMb + ' MB mỗi tệp.'
      : '');
    if (valid.length) onSelect(valid);
  }

  return (
    <div className="upload-area">
      <div
        className={'upload-zone' + (dragging ? ' dragging' : '')}
        onDragOver={event => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          select(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="upload-icon"><Icon name="upload" size={24} /></span>
        <div className="upload-copy">
          <h2>Thêm tài liệu</h2>
          <p>Kéo thả hoặc chọn file từ máy. Tối đa {maxSizeMb} MB mỗi tệp.</p>
          <small>PDF và DOCX hỗ trợ tìm kiếm. Ảnh cần OCR.</small>
        </div>
        <button className="secondary" type="button" disabled={uploading} onClick={() => input.current?.click()}>
          <Icon name={uploading ? 'history' : 'plus'} size={18} />
          {uploading ? 'Đang tải…' : 'Chọn tệp'}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={constants.allowed_extensions.join(',')}
          onChange={event => {
            select(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
