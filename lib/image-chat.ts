export interface ImageAttachment {
  type: 'image';
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface GeneratedImage {
  mimeType: string;
  dataUrl: string;
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ImageAttachment[];
  images?: GeneratedImage[];
  meta?: {
    model?: string;
    fallbackUsed?: boolean;
    quickReplies?: string[];
    intakeType?: 'exam-prep';
    intakeQuestionKey?: string;
  };
}

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
