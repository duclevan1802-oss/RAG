// Hiển thị tên tệp đính kèm, kèm nút bỏ tệp nếu nơi gọi truyền thao tác đó.

import type { Attachment } from '../../types/chat';
import Icon from '../Icon';

export default function AttachmentList({
  attachments, onRemove,
}: { attachments: Attachment[]; onRemove?: (id: string) => void }) {
  if (!attachments.length) return null;
  return (
    <div className="attachments">
      {attachments.map(attachment => (
        <span className="attachment" key={attachment.id}>
          <Icon name="file" size={16} />
          {attachment.filename}
          {onRemove && (
            <button
              type="button"
              className="icon-button"
              aria-label={'Bỏ ' + attachment.filename}
              onClick={() => onRemove(attachment.id)}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
