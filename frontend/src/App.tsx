import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatPage from './pages/ChatPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import KnowledgeBaseDetailPage from './pages/KnowledgeBaseDetailPage';
import { documents as initialDocuments } from './mocks/data';
import type { KnowledgeBase } from './types/document';
import type { Attachment, Conversation, MessageFromApi, RagSourceFromApi } from './types/chat';
import {checkHealth, getDocuments, getKnowledgeBases, uploadDocument, deleteDocument, createKnowledgeBase, streamRagQuestion, getConversations,getConversationMessages, createConversation, saveConversationMessage, deleteConversation,} from './services/api';
import constants from '../../shared/constants.json';

function freshConversation(): Conversation {
  return {
    id: null,
    title:
      constants.conversation_default_title,
    messages: [],
  };
}
export default function App() {
  const [page, setPage] = useState<'chat' | 'documents'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>(() => [freshConversation()]);
  const sendingRef = useRef(false);
  const loadingMessagesRef = useRef(new Set<string>());
  const streamControllerRef = useRef<AbortController | null>(null);
  const [streamConversationId, setStreamConversationId] =
    useState<string | null>(null);

  function stopGenerating() {
    streamControllerRef.current?.abort();
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [basesError, setBasesError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const active =
    conversations.find(
      conversation =>
        conversation.id === activeId,
    ) ?? conversations[0];
  const visibleConversations =
    conversations.filter(conversation => {
      const isSaved =
        conversation.id !== null;

      const isActiveDraft =
        conversation.id === active.id;

      const hasMessages =
        conversation.messages.length > 0;

      return (
        isSaved ||
        isActiveDraft ||
        hasMessages
      );
    });

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
      const savedConversations = await getConversations();

      const history: Conversation[] = savedConversations.map(conversation => ({
        id: conversation.id,
        title: conversation.title,
        messages: [],
        messagesState: 'unloaded',
      }));

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
  conversationId: string | null,
) {
  
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
    if (conversationId !== null) {
      await deleteConversation(
        conversationId
      );
    }

    const nextConversation =
      conversations.find(
        conversation =>
          conversation.id !==
          conversationId,
      );

    setConversations(old => {
      const remaining = old.filter(
        conversation =>
          conversation.id !==
          conversationId,
      );

      return remaining.length > 0
        ? remaining
        : [freshConversation()];
    });

    if (
      active.id === conversationId
    ) {
      setActiveId(
        nextConversation?.id ?? null
      );
    }
    if (active.id === conversationId) {
      setActiveId(nextConversation?.id ?? null);
      void loadConversationMessages(nextConversation?.id ?? null);
    }    
  } catch (error) {
    setHistoryError(
      error instanceof Error
        ? error.message
        : 'Không xóa được hội thoại.',
    );
  }
}
function newChat() {
  if (sendingRef.current) {
    setHistoryError(
      'Hãy đợi câu trả lời hiện tại hoàn tất.',
    );
    return;
  }

  setHistoryError('');

  const draft =
    freshConversation();

  setConversations(old => [
    draft,

    ...old.filter(
      conversation =>
        conversation.id !== null,
    ),
  ]);

  setActiveId(null);
  setPage('chat');
}
async function loadConversationMessages(id: string | null) {
  if (id === null || loadingMessagesRef.current.has(id)) return;

  const conversation = conversations.find(item => item.id === id);
  if (
    conversation?.messagesState !== 'unloaded' &&
    conversation?.messagesState !== 'error'
  ) return;

  loadingMessagesRef.current.add(id);
  setConversations(old => old.map(item =>
    item.id === id ? { ...item, messagesState: 'loading' } : item,
  ));

  try {
    const data = await getConversationMessages(id);
    const messages = data.map(message => ({
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
    }));

    setConversations(old => old.map(item =>
      item.id === id ? { ...item, messages, messagesState: 'loaded' } : item,
    ));
  } catch {
    setConversations(old => old.map(item =>
      item.id === id ? { ...item, messagesState: 'error' } : item,
    ));
  } finally {
    loadingMessagesRef.current.delete(id);
  }
}

function handleSelectConversation(id: string | null) {
  setActiveId(id);
  setPage('chat');
  void loadConversationMessages(id);
}
async function send(
  content: string,
  attachments: Attachment[],
  knowledgeBaseId: string,
) 
{
  if (!content.trim()) return;

  if (sendingRef.current) {
    setHistoryError(
      'Hãy đợi câu trả lời hiện tại hoàn tất.',
    );
    return;
  }

  sendingRef.current = true;
  setHistoryError('');

let conversationId = active.id;

try {
  let savedUserMessage:
    MessageFromApi;

  if (conversationId === null) {
    const started =
      await createConversation(content);

    const createdConversation =
      started.conversation;

    conversationId =
      createdConversation.id;

    savedUserMessage =
      started.message;

    // Bản nháp là conversation duy nhất
    // có id bằng null.
    setConversations(old =>
      old.map(conversation =>
        conversation.id === null
          ? {
              ...conversation,
              id:
                createdConversation.id,
              title:
                createdConversation.title,
            }
          : conversation,
      ),
    );

    setActiveId(
      createdConversation.id
    );
  } else {
    savedUserMessage =
      await saveConversationMessage(
        conversationId,
        {
          role: 'user',
          content,
        },
      );
  }

  if (conversationId === null) {
    throw new Error(
      'Backend chưa trả về ID hội thoại.',
    );
  }

  const savedConversationId:
    string = conversationId;
    const replyToMessageId = savedUserMessage.id;
    setConversations(old =>
      old.map(conversation =>
        conversation.id !== savedConversationId
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
                  id: null,
                  role: 'assistant',
                  replyToMessageId,
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
    const controller = new AbortController();
    streamControllerRef.current = controller;
    setStreamConversationId(savedConversationId);
    try {
      await streamRagQuestion(
        content,
        knowledgeBaseId,
        savedConversationId,
        savedUserMessage.id,
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
          if (event.type === 'done') {
            sources = sources.filter(
              (_, index) =>
                answer.includes(
                  `[Nguồn ${index + 1}]`
                ),
            );
          }          

          if (
            event.type === 'done' &&
            event.done_reason === 'length'
          ) {
            answer += '\n\n[Câu trả lời đã đạt giới hạn độ dài.]';
          }

          setConversations(old =>
            old.map(conversation => {
              if (conversation.id !== savedConversationId) {
                return conversation;
              }

              return {
                ...conversation,
                messages: conversation.messages.map(message => {
                  const isPendingAssistant =
                    message.id === null &&
                    message.role === 'assistant' &&
                    message.replyToMessageId === replyToMessageId

                  if (!isPendingAssistant) {
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
        controller.signal,
      );
    } catch (error) {
      const stopped = controller.signal.aborted;

      if (stopped) {
        answer = answer.trim()
          ? `${answer}\n\n[Đã dừng tạo]`
          : 'Đã dừng tạo.';
      } else {
        answerStatus = 'failed';

        const errorMessage = error instanceof Error
          ? error.message
          : 'Không nhận được câu trả lời.';

        answer += `${answer ? '\n\n' : ''}Có lỗi: ${errorMessage}`;
    }

      setConversations(old =>
        old.map(conversation => {
          if (conversation.id !==savedConversationId) {
            return conversation;
          }
          
          return {
            ...conversation,
            messages: conversation.messages.map(message =>
              message.id === null &&
              message.role === 'assistant' &&
              message.replyToMessageId === replyToMessageId
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
      if (stopped) return;
    } finally {
      streamControllerRef.current = null;
      setStreamConversationId(null);
    }      

  
    try {
      const savedAssistant = await saveConversationMessage(
          savedConversationId,
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
          if (conversation.id !== savedConversationId){
            return conversation;
          }

          return {
            ...conversation,
            messages: conversation.messages.map(message =>
              message.id === null &&
              message.role === 'assistant' &&
              message.replyToMessageId === replyToMessageId
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
const chatContent =
  active.messagesState === 'error' ? (
    <button
      type="button"
      className="secondary"
      onClick={() => void loadConversationMessages(active.id)}
    >
      Không tải được tin nhắn. Thử lại
    </button>
  ) : active.messagesState === 'loading' || active.messagesState === 'unloaded' ? (
    <p role="status">Đang tải tin nhắn…</p>
  ) : (
    <ChatPage
      key={active.id ?? 'unsaved-draft'}
      conversation={active}
      knowledgeBases={bases}
      onSend={send}
      canStop={active.id !== null && active.id === streamConversationId}
      onStop={stopGenerating}
    />
  );
  return <div className="app"><Sidebar page={page} onNavigate={p => { setPage(p); setSelectedBase(null); }} conversations={visibleConversations} activeId={active.id} onSelect={handleSelectConversation} onNew={newChat} onDelete={handleDeleteConversation}/><main className="main"><div className="demo-bar">{basesError && <span role="alert">{basesError}</span>}{historyError && <span role="alert">{historyError}</span>}{uploading && <span>Đang tải và xử lý tài liệu...</span>}<span>GIAO DIỆN MẪU</span><span className="backend-status">API {health === 'checking' ? 'đang kiểm tra…' : health === 'online' ? 'đã kết nối · RAG chưa tích hợp' : 'chưa kết nối'}</span></div>{page === 'chat' ? chatContent : selected ?<KnowledgeBaseDetailPage knowledgeBase={selected} documents={documents.filter(d => d.knowledgeBaseId === selected.id)} onBack={() => setSelectedBase(null)} onAdd={files => handleUpload(selected.id, files)} onDelete={handleDeleteDocument}/> : <KnowledgeBasePage knowledgeBases={bases} documents={documents} onOpen={setSelectedBase} onCreate={handleCreateKnowledgeBase}/>}</main></div>;}
