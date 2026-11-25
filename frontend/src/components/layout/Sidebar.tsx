import Icon from '../Icon';
import type {
  Conversation,
} from '../../types/chat';

interface Props {
  page: 'chat' | 'documents';

  onNavigate: (
    page: 'chat' | 'documents'
  ) => void;

  conversations: Conversation[];

  activeId: string | null;

  onSelect: (
    id: string | null
  ) => void;

  onNew: () => void;

  onDelete: (
    id: string | null
  ) => void;
}

export default function Sidebar(
  props: Props,
) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Icon
            name="book"
            size={24}
          />
        </span>

        <div>
          VIT AI
          <small>
            Không gian tri thức
          </small>
        </div>
      </div>

      <button
        className="new-chat"
        onClick={props.onNew}
      >
        <Icon name="plus" />
        Cuộc trò chuyện mới
      </button>

      <nav aria-label="Điều hướng">
        <button
          className={
            props.page === 'chat'
              ? 'nav-item active'
              : 'nav-item'
          }
          onClick={() =>
            props.onNavigate('chat')
          }
        >
          <Icon name="chat" />
          Trò chuyện
        </button>

        <button
          className={
            props.page === 'documents'
              ? 'nav-item active'
              : 'nav-item'
          }
          onClick={() =>
            props.onNavigate(
              'documents'
            )
          }
        >
          <Icon name="book" />
          Kho tài liệu
        </button>
      </nav>

      <div className="section-label">
        CUỘC TRÒ CHUYỆN
      </div>

      <div className="history">
        {props.conversations.map(
          conversation => (
            <div
              key={
                conversation.id ??
                'unsaved-draft'
              }
              className={
                `history-row ${
                  props.activeId ===
                    conversation.id &&
                  props.page === 'chat'
                    ? 'selected'
                    : ''
                }`
              }
            >
              <button
                onClick={() =>
                  props.onSelect(
                    conversation.id
                  )
                }
              >
                <Icon
                  name="chat"
                  size={16}
                />

                <span>
                  {conversation.title}
                </span>
              </button>

              <button
                className="icon-button"
                aria-label={
                  `Xóa ${
                    conversation.title
                  }`
                }
                onClick={() =>
                  props.onDelete(
                    conversation.id
                  )
                }
              >
                <Icon
                  name="trash"
                  size={14}
                />
              </button>
            </div>
          ),
        )}
      </div>

      <div className="sidebar-footer">
        <span className="avatar">
          B
        </span>

        <div>
          Không gian cá nhân
          <small>
            Phiên dùng thử giao diện
          </small>
        </div>
      </div>
    </aside>
  );
}