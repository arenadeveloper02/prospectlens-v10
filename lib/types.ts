export type ChatRole = 'user' | 'assistant';

export interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** True when this assistant reply is a fallback/notice (request didn't fully complete). */
  isNotice?: boolean;
}

export interface ChatApiResponse {
  reply: string;
}

export interface QuickPhrase {
  label: string;
  message: string;
}
