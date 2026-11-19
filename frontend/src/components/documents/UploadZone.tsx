import { useRef, useState } from 'react';
import Icon from '../Icon';
import constants from '../../../../shared/constants.json';
export default function UploadZone({ onSelect }: { onSelect: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  function select(files: File[]) {
    const valid = files.filter(f => constants.allowed_extensions.some(ext => f.name.toLowerCase().endsWith(ext)) && f.size <= constants.max_file_size_bytes);
    setError(valid.length < files.length ? `Chỉ nhận PDF, DOCX, PNG hoặc JPG, tối đa ${constants.max_file_size_bytes / 1024 / 1024} MB mỗi file.` : '');
    onSelect(valid);
  }
  return <><div className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); select(Array.from(e.dataTransfer.files)); }}><span className="upload-icon"><Icon name="upload" size={26}/></span><h3>Kéo thả tài liệu vào đây</h3><p>PDF, DOCX, PNG hoặc JPG · Tối đa {constants.max_file_size_bytes / 1024 / 1024} MB mỗi file</p><button className="secondary" onClick={() => input.current?.click()}>Chọn từ máy tính</button><input ref={input} type="file" hidden multiple accept={constants.allowed_extensions.join(',')} onChange={e => { select(Array.from(e.target.files ?? [])); e.target.value = ''; }}/></div>{error && <p className="error" role="alert">{error}</p>}</>;
}
