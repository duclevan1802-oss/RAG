// Bố trí màn hình chat, chọn nguồn tài liệu và quản lý vị trí cuộn của hội thoại.

import { useLayoutEffect, useRef, useState } from 'react';
import type { Conversation, Attachment } from '../types/chat';
import type { KnowledgeBase } from '../types/document';
import MessageList from '../components/chat/MessageList';
import ChatComposer from '../components/chat/ChatComposer';
import Icon from '../components/Icon';

interface Props {
  conversation: Conversation;
  knowledgeBases: KnowledgeBase[];
  onDraftChange: (draft: string) => void;
  onLoadOlder: (beforeId: string, beforePrepend: () => void) => Promise<void>;
  onSend: (content: string, attachments: Attachment[], knowledgeBaseId: string) => void;
  canStop: boolean;
  onStop: () => void;
}

const suggestions = [
  { icon: 'file', title: 'Tóm tắt tài liệu', detail: 'Nắm nhanh các ý chính', prompt: 'Tóm tắt các ý chính trong tài liệu về ' },
  { icon: 'search', title: 'Tra cứu từ tài liệu', detail: 'Tìm câu trả lời kèm nguồn', prompt: 'Tìm thông tin trong kho tài liệu về ' },
  { icon: 'spark', title: 'Giải thích một khái niệm', detail: 'Hiểu qua ví dụ đơn giản', prompt: 'Giải thích bằng ví dụ đơn giản về ' },
  { icon: 'layers', title: 'So sánh thông tin', detail: 'Đối chiếu giữa các tài liệu', prompt: 'So sánh thông tin trong các tài liệu về ' },
];

function isAtChatEnd(viewport: HTMLDivElement) {
  return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 4;
}

export default function ChatPage({
  conversation, knowledgeBases, onDraftChange, onLoadOlder, onSend, canStop, onStop,
}: Props) {
  const draft = conversation.draft ?? '';
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Tự cuộn theo câu trả lời khi người dùng ở cuối. Đọc tin cũ sẽ giữ vị trí đang xem.
  const followLatest = useRef(true);
  const olderAnchor = useRef<{ element: Element; top: number } | null>(null);
  const olderCursor = conversation.olderMessagesCursor;
  const hasMessages = conversation.messages.length > 0;

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;

    const followContentSize = () => {
      if (followLatest.current) {
        viewport.scrollTop = viewport.scrollHeight;
      } else if (isAtChatEnd(viewport)) {
        followLatest.current = true;
        setShowJumpToLatest(false);
      }
    };

    followContentSize();
    const observer = new ResizeObserver(followContentSize);
    observer.observe(list);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hasMessages]);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const anchor = olderAnchor.current;
    olderAnchor.current = null;
    if (viewport && anchor && viewport.contains(anchor.element)) {
      viewport.scrollTop += anchor.element.getBoundingClientRect().top - anchor.top;
    }
  }, [olderCursor]);

  async function loadOlder() {
    if (!olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      await onLoadOlder(olderCursor, () => {
        const element = listRef.current?.firstElementChild;
        if (!element) return;
        followLatest.current = false;
        // Nhớ vị trí của tin đầu đang hiển thị để khôi phục sau khi chèn một trang tin cũ.
        olderAnchor.current = { element, top: element.getBoundingClientRect().top };
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  function jumpToLatest() {
    const viewport = scrollRef.current;
    if (!viewport) return;

    followLatest.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    setShowJumpToLatest(false);
  }

  function send(content: string, attachments: Attachment[]) {
    const selectedBase = knowledgeBases.find(base => base.id === selectedBaseId);
    if (selectedBaseId && !selectedBase) {
      setSourceError('Bộ tài liệu này không còn trong danh sách. Hãy chọn bộ khác.');
      return;
    }
    setSourceError('');
    jumpToLatest();
    onSend(content, attachments, selectedBase?.id ?? '');
  }

  function fillSuggestion(prompt: string) {
    onDraftChange(prompt);
    inputRef.current?.focus();
  }

  return (
    <section className="chat-page" aria-label="Trò chuyện">
      <header className="topbar">
        <div className="topbar-title">
          <span className="page-icon"><Icon name="chat" size={19} /></span>
          <h1>{hasMessages ? conversation.title : 'Trò chuyện'}</h1>
        </div>
        <span className="model-chip" title="Mô hình chạy trên Groq">
          <Icon name="cpu" size={17} />
          GPT-OSS 20B
        </span>
      </header>

      <div
        ref={scrollRef}
        className={'chat-scroll' + (hasMessages ? '' : ' is-empty')}
        role={hasMessages ? 'region' : undefined}
        aria-label={hasMessages ? 'Tin nhắn' : undefined}
        tabIndex={hasMessages ? 0 : undefined}
        onScroll={hasMessages ? event => {
          const atEnd = isAtChatEnd(event.currentTarget);
          followLatest.current = atEnd;
          setShowJumpToLatest(!atEnd);
        } : undefined}
      >
        {olderCursor && (
          <div className="older-messages">
            <button className="secondary" type="button" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Đang tải tin nhắn…' : 'Tải tin nhắn cũ hơn'}
            </button>
          </div>
        )}
        {hasMessages ? <MessageList ref={listRef} messages={conversation.messages} /> : (
          <div className="welcome">
            <div className="welcome-lead">
              <div className="welcome-copy">
                <h2>Hỏi từ <span>tài liệu</span> của bạn</h2>
                <p>Tóm tắt nội dung, giải thích khái niệm hoặc tìm câu trả lời kèm nguồn.</p>
              </div>
              <div className="welcome-visual" aria-hidden="true">
                <span className="welcome-node welcome-node-file"><Icon name="file" size={25} /></span>
                <span className="welcome-mark"><Icon name="spark" size={33} /></span>
                <span className="welcome-node welcome-node-chat"><Icon name="chat" size={22} /></span>
              </div>
            </div>
            <div className="suggestions" role="group" aria-label="Gợi ý câu hỏi">
              {suggestions.map(suggestion => (
                <button key={suggestion.title} type="button" onClick={() => fillSuggestion(suggestion.prompt)}>
                  <span className="suggestion-icon"><Icon name={suggestion.icon} size={20} /></span>
                  <span>
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.detail}</small>
                  </span>
                  <span className="suggestion-arrow"><Icon name="chevron" size={16} /></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-bottom">
        {hasMessages && showJumpToLatest && (
          <button
            className="icon-button chat-jump"
            type="button"
            aria-label="Đến tin nhắn mới nhất"
            title="Đến tin nhắn mới nhất"
            onClick={() => {
              jumpToLatest();
              scrollRef.current?.focus({ preventScroll: true });
            }}
          >
            <Icon name="arrow" size={18} />
          </button>
        )}
        <ChatComposer
          value={draft}
          inputRef={inputRef}
          onChange={onDraftChange}
          onSend={send}
          canStop={canStop}
          onStop={onStop}
          sourceControl={
            <label className="kb-select">
              <Icon name="book" size={17} />
              <span>Nguồn</span>
              <select
                aria-label="Chọn nguồn tài liệu"
                value={selectedBaseId}
                onChange={event => {
                  setSelectedBaseId(event.target.value);
                  setSourceError('');
                }}
              >
                <option value="">Tất cả bộ tài liệu</option>
                {knowledgeBases.map(base => <option key={base.id} value={base.id}>{base.name}</option>)}
              </select>
            </label>
          }
        />
        {sourceError && <p className="error composer-error" role="alert">{sourceError}</p>}
      </div>
    </section>
  );
}
