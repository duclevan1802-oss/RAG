// Kết xuất danh sách tin nhắn theo thứ tự của hội thoại đang mở.

import type { Ref } from 'react';

import type {
  Message,
} from '../../types/chat';

import MessageBubble
  from './MessageBubble';

export default function MessageList({
  messages,
  ref,
}: {
  messages: Message[];
  ref?: Ref<HTMLDivElement>;
}) {
  // ID câu hỏi giữ nhận diện của ô trả lời ổn định khi backend cấp ID thật cho tin AI.
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
        />
      ))}
    </div>
  );
}
