// Quản lý điều hướng, dữ liệu kho tài liệu, lịch sử và luồng gửi câu hỏi của ứng dụng.

import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatPage from './pages/ChatPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import KnowledgeBaseDetailPage from './pages/KnowledgeBaseDetailPage';
import Icon from './components/Icon';
import type { DocumentListState, KnowledgeBase } from './types/document';
import type { Attachment, Conversation, MessageFromApi, RagSourceFromApi, Source } from './types/chat';
import {checkHealth, getDocuments, getKnowledgeBases, uploadDocument, deleteDocument, createKnowledgeBase, streamRagQuestion, getConversations, getConversationMessagePage, createConversation, saveConversationMessage, deleteConversation,} from './services/api';
import constants from '../../shared/constants.json';

function requestWorkspaceOverview() {
  return {
    health: checkHealth(AbortSignal.timeout(5000)),
    bases: getKnowledgeBases(),
    conversations: getConversations(),
  };
}

function displaySources(sources: RagSourceFromApi[]): Source[] {
  return sources.map(source => ({
    id: source.chunk_id,
    filename: source.filename,
    page: source.page_number ?? undefined,
    excerpt: source.text,
    number: source.source_number ?? undefined,
  }));
}

// Bản nháp dùng id null. Backend chỉ tạo hội thoại khi người dùng gửi câu hỏi đầu tiên.
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
  const overviewRequestsRef = useRef<ReturnType<typeof requestWorkspaceOverview> | null>(null);
  const sendingRef = useRef(false);
  const loadingMessagesRef = useRef(new Set<string>());
  const loadingDocumentsRef = useRef(new Set<string>());
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
  const [documentLists, setDocumentLists] = useState<Partial<Record<string, DocumentListState>>>({});
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
    let cancelled = false;
    // Dùng lại các promise khởi động khi React StrictMode chạy lại effect trong lúc phát triển.
    const requests = overviewRequestsRef.current ??= requestWorkspaceOverview();

    void requests.health.then(ok => {
      if (!cancelled) setHealth(ok ? 'online' : 'offline');
    }).catch(() => {
      if (!cancelled) setHealth('offline');
    });

    void requests.bases.then(knowledgeBases => {
      if (cancelled) return;

      setBases(current => [
        ...knowledgeBases,
        ...current.filter(base => !knowledgeBases.some(loaded => loaded.id === base.id)),
      ]);
      setBasesError('');
    }).catch(() => {
      if (!cancelled) setBasesError('Không tải được danh sách bộ tài liệu.');
    });

    // Danh sách ban đầu chỉ cần tiêu đề. Nội dung được tải theo hội thoại khi người dùng mở.
    void requests.conversations.then(savedConversations => {
      if (cancelled) return;

      const history: Conversation[] = savedConversations.map(conversation => ({
        id: conversation.id,
        title: conversation.title,
        messages: [],
        messagesState: 'unloaded',
      }));
      setConversations(current => [
        ...current,
        ...history.filter(saved => !current.some(item => item.id === saved.id)),
      ]);
      setHistoryError('');
    }).catch(() => {
      if (!cancelled) setHistoryError('Không tải được lịch sử hội thoại.');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Tải file theo từng bộ khi mở, đồng thời dùng lại danh sách đã tải trong phiên.
  async function loadKnowledgeBaseDocuments(id: string) {
    if (documentLists[id]?.status === 'loaded' || loadingDocumentsRef.current.has(id)) return;

    loadingDocumentsRef.current.add(id);
    setDocumentLists(current => ({ ...current, [id]: { status: 'loading' } }));

    try {
      const files = await getDocuments(id);
      setDocumentLists(current => ({ ...current, [id]: { status: 'loaded', files } }));
    } catch {
      setDocumentLists(current => ({ ...current, [id]: { status: 'error' } }));
    } finally {
      loadingDocumentsRef.current.delete(id);
    }
  }

  function handleOpenKnowledgeBase(id: string) {
    setSelectedBase(id);
    void loadKnowledgeBaseDocuments(id);
  }

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

      setDocumentLists(current => {
        const list = current[knowledgeBaseId];
        if (list?.status !== 'loaded') return current;
        return {
          ...current,
          [knowledgeBaseId]: { status: 'loaded', files: [...list.files, uploadedFile] },
        };
      });
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
async function handleDeleteDocument(knowledgeBaseId: string, fileId: string) {
  const confirmed = window.confirm(
    'Bạn có chắc muốn xóa tài liệu này?',
  );

  if (!confirmed) return;

  setBasesError('');

  try {
    await deleteDocument(fileId);

    setDocumentLists(current => {
      const list = current[knowledgeBaseId];
      if (list?.status !== 'loaded') return current;
      return {
        ...current,
        [knowledgeBaseId]: { status: 'loaded', files: list.files.filter(file => file.id !== fileId) },
      };
    });
  } catch (error) {
    setBasesError(
      error instanceof Error
        ? error.message
        : 'Không xóa được tài liệu.',
    );
  }
}
async function handleCreateKnowledgeBase(name: string): Promise<string | null> {
  setBasesError('');

  try {
    const newBase = await createKnowledgeBase(name);

    setBases(old => [...old, { ...newBase, document_count: newBase.document_count ?? 0 }]);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Không tạo được bộ tài liệu.';
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
async function loadConversationMessages(id: string | null, beforeId?: string, beforePrepend?: () => void) {
  if (id === null || loadingMessagesRef.current.has(id)) return;

  const conversation = conversations.find(item => item.id === id);
  if (!conversation) return;
  if (beforeId ? conversation.olderMessagesCursor !== beforeId : (
    conversation.messagesState !== 'unloaded' &&
    conversation.messagesState !== 'error'
  )) return;

  loadingMessagesRef.current.add(id);
  if (!beforeId) {
    setConversations(old => old.map(item =>
      item.id === id ? { ...item, messagesState: 'loading' } : item,
    ));
  } else {
    setHistoryError('');
  }

  try {
    // Lần đầu lấy trang mới nhất. Khi có beforeId, tải tin đứng trước và chèn lên đầu.
    const messagePage = await getConversationMessagePage(id, beforeId);
    const messages = messagePage.messages.map(message => ({
      id: message.id,
      role: message.role,
      content: message.content,
      thinking: message.thinking ?? undefined,
      sources: displaySources(message.sources),
    }));

    // Cho ChatPage ghi lại vị trí cuộn ngay trước khi chèn các tin cũ.
    beforePrepend?.();
    setConversations(old => old.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        messages: beforeId ? [...messages, ...item.messages] : messages,
        messagesState: 'loaded',
        olderMessagesCursor: messagePage.next_before_id,
      };
    }));
  } catch {
    if (beforeId) {
      setHistoryError('Không tải được tin nhắn cũ hơn. Hãy thử lại.');
    } else {
      setConversations(old => old.map(item =>
        item.id === id ? { ...item, messagesState: 'error' } : item,
      ));
    }
  } finally {
    loadingMessagesRef.current.delete(id);
  }
}

function handleSelectConversation(id: string | null) {
  setActiveId(id);
  setPage('chat');
  void loadConversationMessages(id);
}

function handleDraftChange(draft: string) {
  setConversations(old => old.map(conversation => (
    conversation.id === active.id ? { ...conversation, draft } : conversation
  )));
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

// Giữ bản nháp lúc bấm gửi để nhận biết người dùng có gõ thêm trong lúc chờ lưu hay không.
const submittedDraft = active.draft;
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

    setActiveId(current => current === null ? createdConversation.id : current);
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
    // Gắn ô trả lời tạm với ID câu hỏi để cập nhật đúng tin trong suốt luồng.
    const replyToMessageId = savedUserMessage.id;
    setConversations(old =>
      old.map(conversation =>
        conversation.id !== savedConversationId
          ? conversation
          : {
              ...conversation,
              draft: conversation.draft === submittedDraft ? '' : conversation.draft,
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
    let visibleSources: Source[] = [];
    let streamProgress: string | undefined;
    let renderFrame: number | null = null;

    function renderAssistant(streaming: boolean) {
      if (renderFrame !== null) {
        cancelAnimationFrame(renderFrame);
        renderFrame = null;
      }

      const update = {
        content: answer,
        thinking,
        streaming,
        streamProgress: streaming ? streamProgress : undefined,
        sources: visibleSources,
      };

      setConversations(old => old.map(conversation => {
        if (conversation.id !== savedConversationId) return conversation;
        return {
          ...conversation,
          messages: conversation.messages.map(message => (
            message.id === null &&
            message.role === 'assistant' &&
            message.replyToMessageId === replyToMessageId
          ) ? { ...message, ...update } : message),
        };
      }));
    }

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
          switch (event.type) {
            case 'progress':
              streamProgress = event.content;
              break;
            case 'thinking':
              thinking += event.content;
              break;
            case 'token':
              answer += event.content;
              break;
            case 'sources':
              sources = event.sources.map((source, index) => ({
                ...source,
                source_number: source.source_number ?? index + 1,
              }));
              visibleSources = displaySources(sources);
              return;
            case 'done':
              if (event.done_reason === 'length') {
                answer += '\n\n[Câu trả lời đã đạt giới hạn độ dài.]';
              }
              renderAssistant(false);
              return;
            case 'error':
              return;
          }

          // Gom các đoạn stream đến liên tiếp để React cập nhật tối đa một lần cho mỗi khung hình.
          if (renderFrame === null) {
            renderFrame = requestAnimationFrame(() => {
              renderFrame = null;
              renderAssistant(true);
            });
          }
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

      renderAssistant(false);
      // Nếu người dùng dừng, phần đã nhận vẫn hiển thị trong phiên. Nhánh này kết thúc trước bước lưu AI.
      if (stopped) return;
    } finally {
      streamControllerRef.current = null;
      setStreamConversationId(null);
    }      

  
    try {
      // Frontend lưu câu trả lời, nội dung suy nghĩ và nguồn sau khi nhận xong luồng.
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
    <div className="chat-load-state">
      <span className="page-icon"><Icon name="chat" size={24} /></span>
      <h1>Không tải được tin nhắn</h1>
      <button type="button" className="secondary" onClick={() => void loadConversationMessages(active.id)}>
        Thử lại
      </button>
    </div>
  ) : active.messagesState === 'loading' || active.messagesState === 'unloaded' ? (
    <div className="chat-load-state" role="status">
      <span className="status-spinner" />
      <p>Đang tải tin nhắn…</p>
    </div>
  ) : (
    <ChatPage
      key={active.id ?? 'unsaved-draft'}
      conversation={active}
      knowledgeBases={bases}
      onDraftChange={handleDraftChange}
      onLoadOlder={(beforeId, beforePrepend) => loadConversationMessages(active.id, beforeId, beforePrepend)}
      onSend={send}
      canStop={active.id !== null && active.id === streamConversationId}
      onStop={stopGenerating}
    />
  );
  return (
    <div className="app">
      <a className="skip-link" href="#workspace-main">Đến nội dung</a>
      <Sidebar
        page={page}
        health={health}
        onNavigate={destination => {
          setPage(destination);
          setSelectedBase(null);
        }}
        conversations={visibleConversations}
        activeId={active.id}
        onSelect={handleSelectConversation}
        onNew={newChat}
        onDelete={handleDeleteConversation}
      />
      <main className="main" id="workspace-main" tabIndex={-1}>
        {(basesError || historyError || uploading) && (
          <div className="workspace-notices">
            {basesError && <p className="error" role="alert">{basesError}</p>}
            {historyError && <p className="error" role="alert">{historyError}</p>}
            {uploading && (
              <p className="working-notice" role="status">
                <i className="status-spinner" />Đang tải và xử lý tài liệu…
              </p>
            )}
          </div>
        )}
        {page === 'chat' ? chatContent : selected ? (
          <KnowledgeBaseDetailPage
            knowledgeBase={selected}
            documentList={documentLists[selected.id]}
            uploading={uploading}
            onBack={() => setSelectedBase(null)}
            onRetry={() => void loadKnowledgeBaseDocuments(selected.id)}
            onAdd={files => handleUpload(selected.id, files)}
            onDelete={fileId => handleDeleteDocument(selected.id, fileId)}
          />
        ) : (
          <KnowledgeBasePage
            knowledgeBases={bases.map(base => {
              const list = documentLists[base.id];
              return list?.status === 'loaded' ? { ...base, document_count: list.files.length } : base;
            })}
            onOpen={handleOpenKnowledgeBase}
            onCreate={handleCreateKnowledgeBase}
          />
        )}
      </main>
    </div>
  );
}
