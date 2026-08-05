export type ChatRole = 'user' | 'assistant';

/** One structured candidate returned by the workflow's search turn. */
export interface CandidateCard {
  /** 1-based pick number the user replies with to enrich this contact. */
  index: number;
  name: string;
  title: string;
  company: string;
  linkedin?: string;
}

export interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** True when this assistant reply is a fallback/notice (request didn't fully complete). */
  isNotice?: boolean;
  /** Structured candidates parsed from the workflow response — rendered as clickable numbered cards. */
  candidates?: CandidateCard[];
}

export interface ChatApiResponse {
  reply: string;
  /** Structured candidates from the search turn, when the workflow returned them. */
  candidates?: CandidateCard[];
  /** Machine-readable upstream failure code (e.g. "upstream_unreadable"). */
  error?: string;
  /** HTTP status returned by the workflow service when the call failed. */
  status?: number;
}

export interface QuickPhrase {
  label: string;
  message: string;
}
