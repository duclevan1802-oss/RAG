import type { Ref } from 'react';

import type {
  Message,
} from '../../types/chat';

import MessageBubble
  from './MessageBubble';

export default function MessageList({
  messages,
  showStreaming,
  ref,
}: {
  messages: Message[];
  showStreaming: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className="message-list"
      role="log"
      aria-label="Nội dung hội thoại"
    >
      {messages.map(message => (
        <MessageBubble
          key={
            message.replyToMessageId
              ? `reply-${message.replyToMessageId}`
              : message.id
          }
          message={message}
          showStreaming={showStreaming}
        />
      ))}
    </div>
  );
}
