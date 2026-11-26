import { memo, useState } from 'react';
import type { Message } from '../../types/chat';
import AttachmentList from './AttachmentList';
import SourcePanel from './SourcePanel';
import Icon from '../Icon';

export default memo(function MessageBubble({ message, showStreaming }: { message: Message; showStreaming: boolean }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const user = message.role === 'user';
  const hasAnswer = Boolean(message.content.trim());
  const showAnswer = hasAnswer && (showStreaming || !message.streaming);
  const showThinking = showStreaming && Boolean(message.thinking?.trim());
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
    <article className={'message ' + message.role}>
      {!user && <span className="message-avatar"><Icon name="spark" size={19} /></span>}
      <div className="message-body">
        {showThinking && (
          <details className="thinking">
            <summary>
              {isThinking && <i className="status-spinner" aria-hidden="true" />}
              {isThinking ? 'Đang suy nghĩ…' : 'Quá trình suy nghĩ'}
              <Icon name="chevron" size={15} />
            </summary>
            <p>{message.thinking}</p>
          </details>
        )}
        {message.streaming && !showAnswer && !showThinking && (
          <p className="message-progress" role="status">
            <i className="status-spinner" aria-hidden="true" />
            Đang tạo câu trả lời…
          </p>
        )}
        {(user || showAnswer) && (
          <div className="message-bubble">
            <strong className="message-author">{user ? 'Bạn' : 'VIT AI'}</strong>
            {showAnswer && (
              <p className={'message-text' + (message.streaming ? ' is-streaming' : '')}>{message.content}</p>
            )}
            <AttachmentList attachments={message.attachments ?? []} />
            {!message.streaming && <SourcePanel sources={message.sources ?? []} />}
            {!user && !message.streaming && showAnswer && (
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
