import type { KnowledgeBase, Document } from '../types/document';
export const knowledgeBases: KnowledgeBase[] = [
  { id: 'personal', name: 'Tài liệu cá nhân', description: 'Ý tưởng, ghi chú và kiến thức mỗi ngày.' },
  { id: 'work', name: 'Kiến thức công việc', description: 'Quy trình và tài liệu tham khảo cho công việc.' },
];
export const documents: Document[] = [];
export const suggestions = ['Tóm tắt các ý chính trong tài liệu', 'Tìm câu trả lời từ nhiều tài liệu', 'Giải thích một khái niệm khó', 'So sánh thông tin trong tài liệu'];
