// Tập trung các lời gọi FastAPI và đọc phản hồi JSON thường hoặc luồng NDJSON.

import type {Document, DocumentStatus, KnowledgeBase,} from '../types/document';
import type {ConversationFromApi, MessageFromApi, MessagePageFromApi, RagChatResponse, RagStreamEvent, MessageCreateRequest} from '../types/chat';


// Dùng địa chỉ từ cấu hình Vite và bỏ dấu gạch cuối để ghép đường dẫn endpoint.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal });
  if (!response.ok) return false;
  const result = await response.json();
  return result.status === 'ok';
}
export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge-bases`);

  if (!response.ok) {
    throw new Error('Không tải được danh sách bộ tài liệu.');
  }

  return response.json();
}
interface DocumentFromApi {
  id: string;
  filename: string;
  size: number;
  knowledge_base_id: string;
  status: DocumentStatus;
  error: string | null;
}

export async function getDocuments(
  knowledgeBaseId: string,
): Promise<Document[]> {
  const params = new URLSearchParams({
    knowledge_base_id: knowledgeBaseId,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/documents?${params}`,
  );

  if (!response.ok) {
    throw new Error('Không tải được danh sách tài liệu.');
  }

  const data: DocumentFromApi[] = await response.json();

  return data.map(file => ({
    id: file.id,
    filename: file.filename,
    size: file.size,
    knowledgeBaseId: file.knowledge_base_id,
    status: file.status,
    error: file.error ?? undefined,
  }));
}

export async function uploadDocument(
  knowledgeBaseId: string,
  file: File,
): Promise<Document> {
  // Gửi file và ID bộ tài liệu dưới dạng multipart. Trình duyệt tự đặt Content-Type kèm boundary.
  const formData = new FormData();

  formData.append('knowledge_base_id', knowledgeBaseId);
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = `Không tải được file "${file.name}".`;

    try {
      const body = await response.json();

      if (typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
      
    }

    throw new Error(message);
  }

  const data: DocumentFromApi = await response.json();

  return {
    id: data.id,
    filename: data.filename,
    size: data.size,
    knowledgeBaseId: data.knowledge_base_id,
    status: data.status,
    error: data.error ?? undefined,
  };
}
export async function deleteDocument(fileId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    let message = 'Không xóa được tài liệu.';

    try {
      const body = await response.json();

      if (typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
     
    }

    throw new Error(message);
  }
}

export async function createKnowledgeBase(
  name: string,
): Promise<KnowledgeBase> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge-bases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description: '',
    }),
  });

  if (!response.ok) {
    let message = 'Không tạo được bộ tài liệu.';

    try {
      const body = await response.json();

      if (typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
     
    }

    throw new Error(message);
  }

  return response.json();
}

export async function sendRagQuestion(
  question: string,
  knowledgeBaseId: string,
): Promise<RagChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat/rag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      knowledge_base_id: knowledgeBaseId || null,
    }),
  });

  if (!response.ok) {
    let message = 'Không gửi được câu hỏi.';

    try {
      const body = await response.json();

      if (typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
      // Giữ thông báo mặc định nếu phản hồi không phải JSON.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function streamRagQuestion(
  question: string,
  knowledgeBaseId: string,
  conversationId: string,
  currentMessageId: string,
  onEvent: (event: RagStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/rag/stream`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      knowledge_base_id: knowledgeBaseId || null,
      conversation_id: conversationId,
      current_message_id: currentMessageId,
    }),
  });
  if (!response.ok) {
    let message = 'Không gửi được câu hỏi.';
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
    } catch { /* Giữ thông báo mặc định. */ }
    throw new Error(message);
  }
  if (!response.body) throw new Error('Trình duyệt không nhận được luồng dữ liệu.');
  // Đọc byte từ cùng một request. Mỗi dòng JSON hoàn chỉnh biểu diễn một sự kiện RAG.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  function handleLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as RagStreamEvent;
    if (event.type === 'error') throw new Error(event.content);
    if (event.type === 'done') completed = true;
    onEvent(event);
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      // Giữ trạng thái UTF-8 giữa các lần đọc để ký tự tiếng Việt bị chia byte vẫn ghép đúng.
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Phần cuối có thể là một dòng chưa hoàn chỉnh. Giữ lại để nối với lần đọc sau.
      buffer = lines.pop() ?? '';
      lines.forEach(handleLine);
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
    // Sự kiện done xác nhận backend đã báo kết thúc. Hết dữ liệu trước done là luồng bị ngắt.
    if (!completed) throw new Error('Luồng trả lời bị ngắt trước khi hoàn tất.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function getConversations(): Promise<ConversationFromApi[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/conversations`,
  );

  if (!response.ok) {
    throw new Error('Không tải được danh sách hội thoại.');
  }

  return response.json();
}

export async function getConversationMessagePage(
  conversationId: string,
  beforeId?: string,
): Promise<MessagePageFromApi> {
  const path = `/api/conversations/${encodeURIComponent(conversationId)}/messages/page`;
  const query = beforeId ? `?${new URLSearchParams({ before_id: beforeId })}` : '';
  const response = await fetch(
    `${API_BASE_URL}${path}${query}`,
  );

  if (!response.ok) {
    throw new Error('Không tải được tin nhắn của hội thoại.');
  }

  return response.json();
}

export async function createConversation(
  content: string,
): Promise<{
  conversation: ConversationFromApi;
  message: MessageFromApi;
}> {
  const response = await fetch(
    `${API_BASE_URL}/api/conversations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok) {
    throw new Error('Không tạo được hội thoại.');
  }

  return response.json();
}

export async function saveConversationMessage(
  conversationId: string,
  message: MessageCreateRequest,
): Promise<MessageFromApi> {
  const response = await fetch(
    `${API_BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    },
  );

  if (!response.ok) {
    let errorMessage = 'Không lưu được tin nhắn.';

    try {
      const body = await response.json();

      if (typeof body.detail === 'string') {
        errorMessage = body.detail;
      }
    } catch {
      // Giữ thông báo mặc định nếu không đọc được JSON.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    let errorMessage = 'Không xóa được hội thoại.';

    try {
      const body = await response.json();

      if (typeof body.detail === 'string') {
        errorMessage = body.detail;
      }
    } catch {
      // Giữ thông báo mặc định nếu phản hồi không phải JSON.
    }

    throw new Error(errorMessage);
  }
}
