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

/* ------------------------------------------------------------------ */
/* Prospect Lens console contract (/api/identify + /api/enrich)        */
/* ------------------------------------------------------------------ */

/** Enrichment lifecycle for a console contact. */
export type ProspectStatus = 'identified' | 'enriched' | 'no_email';

/**
 * One contact exactly as /api/identify returns it:
 * { id, full_name, title, company_name, location, seniority, confidence,
 *   linkedin_url, photo_url, work_email: '', status: 'identified' }.
 * work_email/status are updated in place by /api/enrich responses.
 */
export interface ProspectContact {
  id: number;
  full_name: string;
  title: string;
  company_name: string;
  location: string;
  seniority: string;
  /** Normalized display string, e.g. "92%". */
  confidence: string;
  linkedin_url: string;
  photo_url: string;
  /** Verified work email — empty string until enrichment succeeds. */
  work_email: string;
  status: ProspectStatus;
}

/** Response body from POST /api/identify. */
export interface IdentifyApiResponse {
  conversationId: string;
  contacts: ProspectContact[];
  message: string;
}

/** Legacy single-candidate enrich response shape (kept for compatibility). */
export interface EnrichApiResponse {
  id: number;
  work_email: string;
  status: 'enriched' | 'no_email';
  message: string;
}

/**
 * One enriched person parsed from the workflow's selected_details_json
 * (fallbacks: candidates, row.data.candidates_json) — returned by POST /api/enrich.
 */
export interface EnrichedPerson {
  id: number;
  full_name: string;
  /** Verified work email — empty string when Apollo found none. */
  work_email: string;
  status: 'enriched' | 'no_email';
}

/** Response body from POST /api/enrich — selection-driven batch enrichment. */
export interface EnrichBatchApiResponse {
  results: EnrichedPerson[];
  /** Same list as `results` — provided so clients can read `contacts` per the console contract. */
  contacts?: EnrichedPerson[];
  message: string;
}
