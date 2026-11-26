import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { KnowledgeBase } from '../types/document';
import Icon from '../components/Icon';

interface Props {
  knowledgeBases: KnowledgeBase[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => Promise<string | null>;
}

export default function KnowledgeBasePage({ knowledgeBases, onOpen, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const searchText = search.trim().toLocaleLowerCase('vi');
  const filteredBases = knowledgeBases.filter(base => base.name.toLocaleLowerCase('vi').includes(searchText));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    if (!name.trim()) {
      setCreateError('Nhập tên bộ tài liệu.');
      nameInput.current?.focus();
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const error = await onCreate(name.trim());
      if (error) setCreateError(error);
      else dialog.current?.close();
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="documents-page">
      <header className="topbar">
        <div className="topbar-title">
          <span className="page-icon"><Icon name="folder" size={19} /></span>
          <h1>Kho tài liệu</h1>
        </div>
        <button ref={createButton} className="primary" type="button" onClick={() => {
          dialog.current?.showModal();
          nameInput.current?.focus();
        }}>
          <Icon name="plus" size={19} /> Tạo bộ tài liệu
        </button>
      </header>

      <div className="page-content">
        <div className="library-intro">
          <div className="page-intro">
            <h2>Bộ tài liệu của bạn</h2>
            <p>Nhóm các file theo chủ đề để chọn đúng nguồn khi trò chuyện.</p>
          </div>
          <span className="collection-count"><Icon name="layers" size={17} />{knowledgeBases.length} bộ tài liệu</span>
        </div>

        <label className="search-box">
          <Icon name="search" size={20} />
          <span className="sr-only">Tìm bộ tài liệu</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Tìm theo tên bộ tài liệu…"
          />
        </label>

        {filteredBases.length ? (
          <div className="kb-grid">
            {filteredBases.map(base => (
              <button type="button" className="kb-card" key={base.id} onClick={() => onOpen(base.id)}>
                <span className="folder-icon"><Icon name="folder" size={23} /></span>
                <span className="kb-card-title">{base.name}</span>
                {base.description && <span className="kb-card-description">{base.description}</span>}
                <span className="kb-card-footer">
                  <span>
                    <Icon name="file" size={15} />
                    {base.document_count == null ? 'Xem tài liệu' : base.document_count + ' tài liệu'}
                  </span>
                  <Icon name="chevron" size={18} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-docs">
            <span className="folder-icon"><Icon name="folder" size={23} /></span>
            <h3>{searchText ? 'Không tìm thấy bộ phù hợp' : 'Chưa có bộ tài liệu'}</h3>
            <p>{searchText ? 'Thử một tên hoặc từ khóa khác.' : 'Tạo một bộ để bắt đầu thêm file.'}</p>
          </div>
        )}
      </div>

      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="create-title"
        onCancel={event => {
          if (creating) event.preventDefault();
        }}
        onClose={() => {
          setName('');
          setCreateError('');
          createButton.current?.focus();
        }}
      >
        <div className="modal-heading">
          <span className="folder-icon"><Icon name="folder" size={23} /></span>
          <button type="button" className="icon-button" disabled={creating} aria-label="Đóng" onClick={() => dialog.current?.close()}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <h2 id="create-title">Tạo bộ tài liệu</h2>
        <form onSubmit={create}>
          <label>
            Tên bộ tài liệu
            <input
              ref={nameInput}
              maxLength={100}
              value={name}
              onChange={event => {
                setName(event.target.value);
                setCreateError('');
              }}
              placeholder="Ví dụ: Tài liệu dự án"
              aria-invalid={!!createError}
              aria-describedby={createError ? 'create-error' : undefined}
            />
          </label>
          {createError && <p className="error" id="create-error" role="alert">{createError}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" disabled={creating} onClick={() => dialog.current?.close()}>Hủy</button>
            <button className="primary" disabled={creating}>{creating ? 'Đang tạo…' : 'Tạo bộ tài liệu'}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
