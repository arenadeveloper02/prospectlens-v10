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
  /** Machine-readable upstream failure code (e.g. "upstream_unreadable"). */
  error?: string;
  /** HTTP status returned by the workflow service when the call failed. */
  status?: number;
}

export interface QuickPhrase {
  label: string;
  message: string;
}
