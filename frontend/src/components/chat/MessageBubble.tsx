// Hiển thị một tin nhắn, phần suy nghĩ và nguồn của câu trả lời AI.

import { lazy, memo, Suspense, useState } from 'react';
import type { Message } from '../../types/chat';
import AttachmentList from './AttachmentList';
import SourcePanel from './SourcePanel';
import Icon from '../Icon';

const activityDots = <span className="activity-dots" aria-hidden="true"><i /><i /><i /></span>;

function PlainMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return <p className={streaming ? 'message-text is-streaming' : 'message-text'}>{content}</p>;
}

// Chỉ tải bộ định dạng khi có câu trả lời AI. Văn bản thường hiện ngay trong lúc chờ.
const AnswerMarkdown = lazy(() =>
  import('./AnswerMarkdown').catch(() => ({ default: PlainMessage })),
);

export default memo(function MessageBubble({ message }: { message: Message }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const user = message.role === 'user';
  const hasAnswer = Boolean(message.content.trim());
  const showThinking = Boolean(message.thinking?.trim());
  const isThinking = message.streaming && !hasAnswer;

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <article className={'message ' + message.role + (message.replyToMessageId ? ' is-new-reply' : '')}>
      {!user && <span className="message-avatar"><Icon name="spark" size={19} /></span>}
      <div className="message-body">
        {!user && <strong className="message-author">VIT AI</strong>}
        {showThinking && (
          <details className="thinking">
            <summary>
              {isThinking ? activityDots : <Icon name="spark" size={15} />}
              {isThinking ? 'Đang suy nghĩ…' : 'Quá trình suy nghĩ'}
              <span className="thinking-chevron"><Icon name="chevron" size={15} /></span>
            </summary>
            <p>{message.thinking}</p>
          </details>
        )}
        {isThinking && !showThinking && (
          <p className="message-progress" role="status">
            {activityDots}
            {message.streamProgress ?? 'Đang tạo câu trả lời…'}
          </p>
        )}
        {(user || hasAnswer) && (
          <div className="message-bubble">
            {user && <strong className="message-author">Bạn</strong>}
            {hasAnswer && (user ? <PlainMessage content={message.content} /> : (
              <Suspense fallback={<PlainMessage content={message.content} streaming={message.streaming} />}>
                <AnswerMarkdown content={message.content} streaming={message.streaming} />
              </Suspense>
            ))}
            <AttachmentList attachments={message.attachments ?? []} />
            {!message.streaming && <SourcePanel sources={message.sources ?? []} answer={message.content} />}
            {!user && !message.streaming && hasAnswer && (
              <div className="message-actions">
                <button className="copy-answer" type="button" onClick={copyAnswer}>
                  <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} size={16} />
                  {copyStatus === 'copied' ? 'Đã sao chép' : 'Sao chép'}
                </button>
                {copyStatus === 'error' && <small className="error" role="status">Không sao chép được. Hãy chọn văn bản để sao chép.</small>}
                {copyStatus === 'copied' && <span className="sr-only" role="status">Đã sao chép câu trả lời</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
