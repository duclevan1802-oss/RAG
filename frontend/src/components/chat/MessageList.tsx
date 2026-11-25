import {
  useEffect,
  useRef,
} from 'react';

import type {
  Message,
} from '../../types/chat';

import MessageBubble
  from './MessageBubble';

export default function MessageList({
  messages,
}: {
  messages: Message[];
}) {
  const end =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  return (
    <div
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
        />
      ))}

      <div ref={end} />
    </div>
  );
}