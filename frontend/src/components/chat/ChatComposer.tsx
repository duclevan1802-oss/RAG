// Xử lý ô nhập, phím gửi, kiểm tra câu hỏi và nút dừng tạo khi đang stream.

import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { Attachment } from '../../types/chat';
import AttachmentList from './AttachmentList';
import Icon from '../Icon';
import constants from '../../../../shared/constants.json';

interface Props {
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSend: (content: string, attachments: Attachment[]) => void;
  canStop: boolean;
  onStop: () => void;
  sourceControl: ReactNode;
}

const maxSizeMb = constants.max_file_size_bytes / 1024 / 1024;

export default function ChatComposer({
  value, inputRef, onChange, onSend, canStop, onStop, sourceControl,
}: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  function send() {
    if (canStop) return;
    if (attachments.length) {
      setError('Chat chưa gửi được file trực tiếp. Hãy tải file lên trong Kho tài liệu hoặc bỏ tệp đính kèm để gửi câu hỏi.');
      return;
    }
    const question = value.trim();
    if (!question) return;
    // Đếm ký tự Unicode theo cùng cách với giới hạn câu hỏi của backend.
    if (Array.from(question).length > constants.question_max_length) {
      const limit = constants.question_max_length.toLocaleString('vi-VN');
      setError(`Câu hỏi tối đa ${limit} ký tự.`);
      return;
    }

    setError('');
    onSend(question, attachments);
  }

  function selectFiles(files: File[]) {
    const validFiles = files.filter(file => file.size <= constants.max_file_size_bytes);
    setError(validFiles.length < files.length
      ? 'Một số file vượt quá ' + maxSizeMb + ' MB và chưa được chọn.'
      : '');
    setAttachments(old => [...old, ...validFiles.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
    }))]);
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={event => event.preventDefault()}>
        <textarea
          ref={inputRef}
          aria-label="Câu hỏi"
          placeholder="Nhập câu hỏi của bạn…"
          rows={1}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            // Shift + Enter xuống dòng. Enter trong lúc bộ gõ còn ghép chữ sẽ không gửi câu hỏi.
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            send();
          }}
        />
        <AttachmentList attachments={attachments} onRemove={id => {
          setAttachments(old => old.filter(attachment => attachment.id !== id));
          setError('');
        }} />
        <div className="composer-tools">
          <button
            type="button"
            className="attach-button"
            aria-label="Chọn tệp đính kèm"
            title="Chọn tệp đính kèm"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="clip" size={19} />
          </button>
          {sourceControl}
          {canStop ? (
            <button key="stop" className="send-button stop-button" type="button" onClick={onStop} aria-label="Dừng tạo" title="Dừng tạo">
              <Icon name="stop" size={21} />
            </button>
          ) : (
            <button key="send" className="send-button" type="button" onClick={send} disabled={!value.trim() && !attachments.length} aria-label="Gửi câu hỏi" title="Gửi câu hỏi">
              <Icon name="arrow" size={21} />
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          hidden
          multiple
          accept=".pdf,.docx,image/*"
          onChange={event => {
            selectFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </form>
      {error && <p className="error composer-error" role="alert">{error}</p>}
      <p className="composer-hint"><kbd>Enter</kbd> để gửi <span aria-hidden="true">·</span> <kbd>Shift + Enter</kbd> để xuống dòng</p>
    </div>
  );
}
