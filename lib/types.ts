export type ChatRole = 'user' | 'assistant';

/** One structured candidate returned by the workflow's search turn (Identify block). */
export interface CandidateCard {
  /** 1-based pick number the user replies with to enrich this contact. */
  index: number;
  /** Stored candidate id from the workflow (Identify.candidates[].id) — the number sent back on selection. Falls back to `index` when absent. */
  id?: number;
  name: string;
  title: string;
  company: string;
  linkedin?: string;
  /** e.g. "San Francisco, CA" — from Identify.candidates[].location. */
  location?: string;
  /** Seniority badge text — from seniority_level. */
  seniority?: string;
  /** Confidence badge text (normalized, e.g. "92%"). */
  confidence?: string;
  /** Avatar image — from photo_url. Never an email or phone. */
  photoUrl?: string;
  /** One-line candidate summary from the workflow. */
  summary?: string;
  /** Verified email merged in AFTER enrichment (Apollo-only — never guessed). */
  email?: string;
  /** Enrichment outcome for this card (e.g. "verified", "unavailable"). Present once enrichment ran for this candidate. */
  emailStatus?: string;
}

/** One enrichment outcome returned by the enrich turn — merged onto the matching card by id. */
export interface EnrichmentResult {
  /** Stored candidate id the workflow keys enrichment on. */
  id: number;
  /** Verified email when Apollo found one. */
  email?: string;
  /** Raw email_status from the workflow (e.g. "verified", "unavailable"). */
  emailStatus?: string;
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
  /** Enrichment outcomes from the enrich turn ({ id, email, emailStatus }) — merged onto existing cards client-side. */
  enrichments?: EnrichmentResult[];
  /** Machine-readable upstream failure code (e.g. "upstream_unreadable"). */
  error?: string;
  /** HTTP status returned by the workflow service when the call failed. */
  status?: number;
}

export interface QuickPhrase {
  label: string;
  message: string;
}
