import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatPage from './pages/ChatPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import KnowledgeBaseDetailPage from './pages/KnowledgeBaseDetailPage';
import { documents as initialDocuments } from './mocks/data';
import type { KnowledgeBase } from './types/document';
import type { Attachment, Conversation, RagSourceFromApi } from './types/chat';
import {checkHealth, getDocuments, getKnowledgeBases, uploadDocument, deleteDocument, createKnowledgeBase, streamRagQuestion, getConversations,getConversationMessages, createConversation, saveConversationMessage, deleteConversation,} from './services/api';
import constants from '../../shared/constants.json';

function freshConversation(): Conversation { return { id: crypto.randomUUID(), title: constants.conversation_default_title, messages: [] }; }
export default function App() {
  const [page, setPage] = useState<'chat' | 'documents'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>(() => [freshConversation()]);
  const sendingRef = useRef(false);
  const [activeId, setActiveId] = useState('');
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [basesError, setBasesError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const active = conversations.find(c => c.id === activeId) ?? conversations[0];
  const visibleConversations = conversations.filter(conversation => 
    {const isMongoId = /^[0-9a-f]{24}$/i.test(conversation.id);
    return isMongoId || conversation.messages.length > 0;});
  const selected = bases.find(b => b.id === selectedBase);
useEffect(() => {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 5000);

  checkHealth(controller.signal)
    .then(ok => setHealth(ok ? 'online' : 'offline'))
    .catch(() => setHealth('offline'));

  return () => {
    clearTimeout(timeout);
    controller.abort();
  };
}, []);
useEffect(() => {
  async function loadData() {
    try {
      
      const knowledgeBases = await getKnowledgeBases();

      
      const documentLists = await Promise.all(
        knowledgeBases.map(base => getDocuments(base.id)),
      );

      setBases(knowledgeBases);

      // Gộp danh sách file của các bộ thành một danh sách.
      setDocuments(documentLists.flat());

      setBasesError('');
    } catch {
      setBasesError('Không tải được bộ tài liệu hoặc danh sách file.');
    }
  }

  loadData();
}, []);
useEffect(() => {
  let cancelled = false;

  async function loadHistory() {
    try {
      // Lấy danh sách hội thoại.
      const savedConversations = await getConversations();

      // Lấy tin nhắn của từng hội thoại.
      const history: Conversation[] = await Promise.all(
        savedConversations.map(async conversation => {
          const savedMessages = await getConversationMessages(
            conversation.id,
          );

          return {
            id: conversation.id,
            title: conversation.title,

            messages: savedMessages.map(message => ({
              id: message.id,
              role: message.role,
              content: message.content,

              thinking: message.thinking ?? undefined,

              sources: message.sources.map(source => ({
                id: source.chunk_id,
                filename: source.filename,
                page: source.page_number ?? undefined,
                excerpt: source.text,
              })),
            })),
          };
        }),
      );

      if (cancelled) return;

      
      setConversations(current => [
        ...current,
        ...history.filter(
          saved => !current.some(item => item.id === saved.id),
        ),
      ]);

      setHistoryError('');
    } catch {
      if (!cancelled) {
        setHistoryError('Không tải được lịch sử hội thoại.');
      }
    }
  }

  loadHistory();

  return () => {
    cancelled = true;
  };
}, []);
async function handleUpload(
  knowledgeBaseId: string,
  files: File[],
) 
{
  if (files.length === 0) return;

  setUploading(true);
  setBasesError('');

  try {
    // Gửi lần lượt từng file để dễ theo dõi kết quả.
    for (const file of files) {
      const uploadedFile = await uploadDocument(
        knowledgeBaseId,
        file,
      );

      setDocuments(old => [...old, uploadedFile]);
    }
  } catch (error) {
    setBasesError(
      error instanceof Error
        ? error.message
        : 'Không tải được file lên.',
    );
  } finally {
    setUploading(false);
  }
}
async function handleDeleteDocument(fileId: string) {
  const confirmed = window.confirm(
    'Bạn có chắc muốn xóa tài liệu này?',
  );

  if (!confirmed) return;

  setBasesError('');

  try {
    await deleteDocument(fileId);

    setDocuments(old => old.filter(file => file.id !== fileId));
  } catch (error) {
    setBasesError(
      error instanceof Error
        ? error.message
        : 'Không xóa được tài liệu.',
    );
  }
}
async function handleCreateKnowledgeBase(name: string) {
  setBasesError('');

  try {
    const newBase = await createKnowledgeBase(name);

    setBases(old => [...old, newBase]);
  } catch (error) {
    setBasesError(
      error instanceof Error
        ? error.message
        : 'Không tạo được bộ tài liệu.',
    );
  }
}
async function handleDeleteConversation(
  conversationId: string,
) 
{
  if (sendingRef.current) {
    setHistoryError(
      'Hãy đợi câu trả lời hoàn tất trước khi xóa hội thoại.',
    );
    return;
  }

  const confirmed = window.confirm(
    'Bạn có chắc muốn xóa hội thoại và các tin nhắn của nó?',
  );

  if (!confirmed) return;

  setHistoryError('');

  try {
    const isMongoId = /^[0-9a-f]{24}$/i.test(conversationId);

    // Hội thoại tạm chỉ tồn tại trên giao diện, không cần gọi API.
    if (isMongoId) {
      await deleteConversation(conversationId);
    }

    setConversations(old => {
      const remaining = old.filter(
        conversation => conversation.id !== conversationId,
      );

      return remaining.length > 0
        ? remaining
        : [freshConversation()];
    });

    // Nếu đang mở hội thoại vừa xóa, chuyển về hội thoại đầu tiên còn lại.
    if (active.id === conversationId) {
      setActiveId('');
    }
  } catch (error) {
    setHistoryError(
      error instanceof Error
        ? error.message
        : 'Không xóa được hội thoại.',
    );
  }
}
async function newChat() {
  setHistoryError('');

  try {
    // Tạo hội thoại trên backend và Atlas.
    const saved = await createConversation();

    // Chuyển dữ liệu sang cấu trúc frontend đang dùng.
    const conversation: Conversation = {
      id: saved.id,
      title: saved.title,
      messages: [],
    };

    setConversations(old => [conversation, ...old]);

    setActiveId(conversation.id);

    setPage('chat');
  } catch {
    setHistoryError('Không tạo được cuộc trò chuyện mới.');
  }
}
async function send(
  content: string,
  attachments: Attachment[],
  knowledgeBaseId: string,
) {
  if (!content.trim()) return;

  if (sendingRef.current) {
    setHistoryError(
      'Hãy đợi câu trả lời hiện tại hoàn tất.',
    );
    return;
  }

  sendingRef.current = true;
  setHistoryError('');

  const originalId = active.id;
  let conversationId = originalId;

  try {
    // Hội thoại tạm trên frontend dùng UUID.
    // ID hội thoại MongoDB có 24 ký tự hex.
    const isMongoId = /^[0-9a-f]{24}$/i.test(conversationId);

    if (!isMongoId) {
      const created = await createConversation();

      conversationId = created.id;

      setConversations(old =>
        old.map(conversation =>
          conversation.id === originalId
            ? {
                ...conversation,
                id: created.id,
                title: created.title,
              }
            : conversation,
        ),
      );

      // Chỉ chuyển lựa chọn nếu người dùng vẫn đang ở hội thoại cũ.
      setActiveId(current => {
        if (current === originalId || current === '') {
          return created.id;
        }

        return current;
      });
    }
const savedUserMessage = await saveConversationMessage(
  conversationId,
  {
    role: 'user',
    content,
  },
);

if (
  active.title === constants.conversation_default_title &&
  !active.messages.some(message => message.role === 'user')
) 
{
  const title = content.trim().slice(
    0,
    constants.conversation_auto_title_length,
  );

  if (title) {
    setConversations(old =>
      old.map(conversation =>
        conversation.id === conversationId
          ? { ...conversation, title }
          : conversation,
      ),
    );
  }
}

    const assistantId = crypto.randomUUID();

    setConversations(old =>
      old.map(conversation =>
        conversation.id !== conversationId
          ? conversation
          : {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: savedUserMessage.id,
                  role: 'user',
                  content: savedUserMessage.content,
                  attachments,
                },
                {
                  id: assistantId,
                  role: 'assistant',
                  content: '',
                  thinking: '',
                  streaming: true,
                  sources: [],
                },
              ],
            },
      ),
    );

    let answer = '';
    let thinking = '';
    let sources: RagSourceFromApi[] = [];

    let answerStatus: 'completed' | 'failed' = 'completed';

    try {
      await streamRagQuestion(
        content,
        knowledgeBaseId,
        event => {
          if (event.type === 'thinking') {
            thinking += event.content;
          }

          if (event.type === 'token') {
            answer += event.content;
          }

          if (event.type === 'sources') {
            sources = event.sources;
          }

          if (
            event.type === 'done' &&
            event.done_reason === 'length'
          ) {
            answer += '\n\n[Câu trả lời đã đạt giới hạn độ dài.]';
          }

          setConversations(old =>
            old.map(conversation => {
              if (conversation.id !== conversationId) {
                return conversation;
              }

              return {
                ...conversation,
                messages: conversation.messages.map(message => {
                  if (message.id !== assistantId) {
                    return message;
                  }

                  return {
                    ...message,
                    content: answer,
                    thinking,
                    streaming: event.type !== 'done',
                    sources: sources.map(source => ({
                      id: source.chunk_id,
                      filename: source.filename,
                      page: source.page_number ?? undefined,
                      excerpt: source.text,
                    })),
                  };
                }),
              };
            }),
          );
        },
      );
    } catch (error) {
      answerStatus = 'failed';

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Không nhận được câu trả lời.';

      answer += `${answer ? '\n\n' : ''}Có lỗi: ${errorMessage}`;

      setConversations(old =>
        old.map(conversation => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            messages: conversation.messages.map(message =>
              message.id === assistantId
                ? {
                    ...message,
                    content: answer,
                    thinking,
                    streaming: false,
                  }
                : message,
            ),
          };
        }),
      );
    }

  
    try {
      const savedAssistant = await saveConversationMessage(
        conversationId,
        {
          role: 'assistant',
          content: answer,
          thinking: thinking || null,
          sources,
          status: answerStatus,
        },
      );

     
      setConversations(old =>
        old.map(conversation => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            messages: conversation.messages.map(message =>
              message.id === assistantId
                ? {
                    ...message,
                    id: savedAssistant.id,
                    streaming: false,
                  }
                : message,
            ),
          };
        }),
      );
    } catch {
      setHistoryError(
        'Đã nhận câu trả lời nhưng chưa lưu được vào lịch sử.',
      );
    }
  } catch (error) {
    setHistoryError(
      error instanceof Error
        ? error.message
        : 'Không lưu được câu hỏi.',
    );
  } finally {
    sendingRef.current = false;
  }
}
  return <div className="app"><Sidebar page={page} onNavigate={p => { setPage(p); setSelectedBase(null); }} conversations={visibleConversations} activeId={active.id} onSelect={id => { setActiveId(id); setPage('chat'); }} onNew={newChat} onDelete={handleDeleteConversation}/><main className="main"><div className="demo-bar">{basesError && <span role="alert">{basesError}</span>}{historyError && <span role="alert">{historyError}</span>}{uploading && <span>Đang tải và xử lý tài liệu...</span>}<span>GIAO DIỆN MẪU</span><span className="backend-status">API {health === 'checking' ? 'đang kiểm tra…' : health === 'online' ? 'đã kết nối · RAG chưa tích hợp' : 'chưa kết nối'}</span></div>{page === 'chat' ? <ChatPage key={active.id} conversation={active} knowledgeBases={bases} onSend={send}/> : selected ? <KnowledgeBaseDetailPage knowledgeBase={selected} documents={documents.filter(d => d.knowledgeBaseId === selected.id)} onBack={() => setSelectedBase(null)} onAdd={files => handleUpload(selected.id, files)} onDelete={handleDeleteDocument}/> : <KnowledgeBasePage knowledgeBases={bases} documents={documents} onOpen={setSelectedBase} onCreate={handleCreateKnowledgeBase}/>}</main></div>;
}
