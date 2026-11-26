// Các kiểu TypeScript cho tin nhắn, nguồn RAG, hội thoại và dữ liệu API chat.

export interface Attachment { id: string; filename: string }
export interface Source { id: string; filename: string; page?: number; excerpt: string; number?: number }
export interface Message {
  id: string | null;
  role: 'user' | 'assistant';
  replyToMessageId?: string;
  content: string;
  thinking?: string;
  streaming?: boolean;
  streamProgress?: string;
  attachments?: Attachment[];
  sources?: Source[];
}

export interface Conversation {
  id: string | null;
  title: string;
  // Nội dung đang gõ chỉ nằm trong trạng thái giao diện của hội thoại này.
  draft?: string;
  messages: Message[];
  messagesState?: 'unloaded' | 'loading' | 'loaded' | 'error';
  olderMessagesCursor?: string | null;
}
export interface RagSourceFromApi {
  chunk_id: string;
  document_id: string;
  filename: string;
  text: string;
  distance: number;
  page_number: number | null;
  block_number: number | null;
  source_number?: number | null;
}

export interface RagChatResponse {
  content: string;
  done_reason: string | null;
  sources: RagSourceFromApi[];
}

export type RagStreamEvent =
  | { type: 'sources'; sources: RagSourceFromApi[] }
  | { type: 'progress' | 'thinking' | 'token'; content: string }
  | { type: 'done'; done_reason?: string }
  | { type: 'error'; content: string };

export interface ConversationFromApi {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ID trong JSON là chuỗi. Repository backend đổi sang hoặc đọc từ BSON ObjectId khi làm việc với MongoDB.
export interface MessageFromApi {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking: string | null;
  sources: RagSourceFromApi[];
  status: 'completed' | 'failed';
  created_at: string;
}

export interface MessagePageFromApi {
  messages: MessageFromApi[];
  next_before_id: string | null;
}

export interface MessageCreateRequest {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string | null;
  sources?: RagSourceFromApi[];
  status?: 'completed' | 'failed';
}
