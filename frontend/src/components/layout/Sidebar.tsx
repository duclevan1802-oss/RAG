import { useRef, useState, useSyncExternalStore } from 'react';
import type { Conversation } from '../../types/chat';
import Icon from '../Icon';

interface Props {
  page: 'chat' | 'documents';
  health: 'checking' | 'online' | 'offline';
  theme: 'light' | 'dark';
  showStreaming: boolean;
  onToggleTheme: () => void;
  onShowStreaming: (show: boolean) => void;
  conversations: Conversation[];
  activeId: string | null;
  onNavigate: (page: 'chat' | 'documents') => void;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onDelete: (id: string | null) => void;
}

const healthLabels = {
  checking: 'Đang kiểm tra kết nối',
  online: 'API đã kết nối',
  offline: 'API chưa kết nối',
};

const mobileLayout = window.matchMedia('(max-width: 51.25rem)');

function subscribeToLayout(onChange: () => void) {
  mobileLayout.addEventListener('change', onChange);
  return () => mobileLayout.removeEventListener('change', onChange);
}

function isMobileLayout() {
  return mobileLayout.matches;
}

function SidebarContent({
  page, health, theme, showStreaming, onToggleTheme, onShowStreaming,
  conversations, activeId, onNavigate, onSelect, onNew, onDelete, onClose,
}: Props & { onClose?: () => void }) {
  return (
    <>
      <div className="sidebar-heading">
        <div className="brand">
          <span className="brand-mark"><Icon name="spark" size={22} /></span>
          <strong>VIT AI</strong>
        </div>
        {onClose && (
          <button className="icon-button drawer-close" type="button" aria-label="Đóng menu" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </div>

      <button className="new-chat" type="button" onClick={onNew}>
        <Icon name="plus" size={19} /> Cuộc trò chuyện mới
      </button>

      <nav className="workspace-nav" aria-label="Điều hướng">
        <button
          type="button"
          className={'nav-item' + (page === 'chat' ? ' active' : '')}
          aria-current={page === 'chat' ? 'page' : undefined}
          onClick={() => onNavigate('chat')}
        >
          <Icon name="chat" size={19} /> Trò chuyện
        </button>
        <button
          type="button"
          className={'nav-item' + (page === 'documents' ? ' active' : '')}
          aria-current={page === 'documents' ? 'page' : undefined}
          onClick={() => onNavigate('documents')}
        >
          <Icon name="folder" size={19} /> Kho tài liệu
        </button>
      </nav>

      <section className="history-section" aria-labelledby="history-label">
        <h2 className="section-label" id="history-label">Gần đây</h2>
        <div className="history">
          {conversations.map(conversation => {
            const selected = page === 'chat' && activeId === conversation.id;
            return (
              <div
                key={conversation.id ?? 'unsaved-draft'}
                className={'history-row' + (selected ? ' selected' : '')}
              >
                <button
                  type="button"
                  className="history-entry"
                  aria-current={selected ? 'true' : undefined}
                  title={conversation.title}
                  onClick={() => onSelect(conversation.id)}
                >
                  <Icon name="chat" size={16} />
                  <span>{conversation.title}</span>
                </button>
                <button
                  className="icon-button history-delete"
                  type="button"
                  aria-label={'Xóa ' + conversation.title}
                  onClick={() => onDelete(conversation.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sidebar-settings">
        <label className="stream-setting">
          <span><strong>Xem streaming</strong><small>Hiện nội dung khi AI đang tạo</small></span>
          <input
            type="checkbox"
            role="switch"
            checked={showStreaming}
            onChange={event => onShowStreaming(event.target.checked)}
          />
        </label>
        <button className="theme-button" type="button" onClick={onToggleTheme}>
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
          {theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
        </button>
        <p className={'connection-label ' + health} role="status"><i />{healthLabels[health]}</p>
      </div>
    </>
  );
}

function MobileSidebar(props: Props) {
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  function closeDrawer() {
    drawer.current?.close();
  }

  return (
    <>
      <div className="mobile-toolbar">
        <button
          type="button"
          className="icon-button menu-button"
          ref={menuButton}
          aria-label="Mở menu"
          aria-controls="workspace-drawer"
          aria-expanded={open}
          onClick={() => {
            drawer.current?.showModal();
            setOpen(true);
          }}
        >
          <Icon name="menu" size={23} />
        </button>
        <div className="brand">
          <span className="brand-mark"><Icon name="spark" size={19} /></span>
          <strong>VIT AI</strong>
        </div>
        <button
          className="icon-button mobile-new-chat"
          type="button"
          aria-label="Cuộc trò chuyện mới"
          onClick={props.onNew}
        >
          <Icon name="plus" size={22} />
        </button>
      </div>
      <dialog
        className="sidebar-drawer"
        id="workspace-drawer"
        ref={drawer}
        aria-label="Không gian làm việc"
        onClose={() => {
          setOpen(false);
          menuButton.current?.focus();
        }}
        onClick={event => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div className="sidebar">
          <SidebarContent
            {...props}
            onClose={closeDrawer}
            onNew={() => {
              closeDrawer();
              props.onNew();
            }}
            onNavigate={page => {
              closeDrawer();
              props.onNavigate(page);
            }}
            onSelect={id => {
              closeDrawer();
              props.onSelect(id);
            }}
          />
        </div>
      </dialog>
    </>
  );
}

export default function Sidebar(props: Props) {
  const isMobile = useSyncExternalStore(subscribeToLayout, isMobileLayout);

  return isMobile ? <MobileSidebar {...props} /> : (
    <aside className="sidebar" aria-label="Không gian làm việc">
      <SidebarContent {...props} />
    </aside>
  );
}
