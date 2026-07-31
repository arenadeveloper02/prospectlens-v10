export type ChatRole = 'user' | 'assistant';

export interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatApiResponse {
  reply: string;
}

export interface QuickPhrase {
  label: string;
  message: string;
}
