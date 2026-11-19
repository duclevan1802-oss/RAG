export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'deleting';
export interface KnowledgeBase { id: string; name: string; description: string }
export interface Document { id: string; knowledgeBaseId: string; filename: string; size: number; status: DocumentStatus; error?: string }
