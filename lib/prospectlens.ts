import type { CandidateCard } from '@/lib/types';

const DEFAULT_API_URL =
  'https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute';
const DEFAULT_API_KEY = 'sk-sim-ywX13HywO8xTjvBbPgqjD-Idk2K4gP7P';

export interface WorkflowConfig {
  url: string;
  key: string;
}

/**
 * Resolves the workflow execute endpoint and API key.
 * Primary env vars: PUREMUON_URL / PUREMUON_API_KEY (set in Vercel).
 * Legacy fallbacks: PROSPECTLENS_API_URL / PROSPECTLENS_API_KEY.
 * Hard defaults point at the healthy 65d2b97b-… workflow.
 */
export function getWorkflowConfig(): WorkflowConfig {
  const envUrl = process.env.PUREMUON_URL ?? process.env.PROSPECTLENS_API_URL;
  const envKey = process.env.PUREMUON_API_KEY ?? process.env.PROSPECTLENS_API_KEY;
  return {
    url: envUrl && envUrl.trim() ? envUrl.trim() : DEFAULT_API_URL,
    key: envKey && envKey.trim() ? envKey.trim() : DEFAULT_API_KEY,
  };
}

/**
 * Structured contract returned by the workflow:
 *   { reply: string, mode?: string, cardCount?: number }
 * or, on search turns, a structured object like
 *   { mode, selected_ids, candidates, message }
 * usually wrapped as { result: { ... } }, { output: { ... } }, or { data: { ... } }.
 */
export interface WorkflowResult {
  reply: string;
  mode?: string;
  cardCount?: number;
}

/**
 * After the terminal agent blocks run, table blocks execute and return raw
 * status strings like "Row updated successfully" / "Rows inserted". These are
 * internal plumbing and must NEVER be shown as the assistant's answer.
 */
const TABLE_STATUS = /^(row|rows)\b.*\b(updated|inserted|upserted|added|saved)\b/i;

export function isTableStatus(text: string): boolean {
  return TABLE_STATUS.test(text.trim());
}

/**
 * Heuristic: does this string look like raw JSON / internal workflow state
 * rather than user-facing prose? Used as defense-in-depth so structured
 * payloads never leak into the chat.
 */
export function looksLikeInternalPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      // Not valid JSON — fall through to keyword checks.
    }
  }
  if (/"(selected_ids|selectedIds|conversationId|blockName|executionId)"\s*:/.test(trimmed)) {
    return true;
  }
  if (/^\s*\{\s*"(mode|candidates|output|result)"/.test(trimmed)) {
    return true;
  }
  return false;
}

function getField(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Like asText, but rejects table-status plumbing strings. */
function asMessageText(value: unknown): string | undefined {
  const text = asText(value);
  return text && !isTableStatus(text) ? text : undefined;
}

/**
 * The workflow ends at one of three AGENT blocks whose text IS the answer.
 * Priority order: Format Export (export turn) → Apollo Contact Finder
 * (selection/enrich turn) → Present Cards (search turn). Table blocks run
 * AFTER these agents and only return status strings — they are ignored.
 */
const AGENT_BLOCK_NAMES = ['Format Export', 'Apollo Contact Finder', 'Present Cards'] as const;

function blockText(block: unknown): string | undefined {
  const text =
    asMessageText(getField(block, 'content')) ??
    asMessageText(getField(getField(block, 'output'), 'content')) ??
    asMessageText(getField(block, 'message')) ??
    asMessageText(getField(getField(block, 'output'), 'message')) ??
    asMessageText(getField(block, 'output'));
  if (text && !looksLikeInternalPayload(text)) return text;
  return undefined;
}

/** Shared list of containers where per-block outputs may live in the execute response. */
function blockContainers(root: unknown): unknown[] {
  return [
    getField(root, 'blocks'),
    getField(getField(root, 'output'), 'blocks'),
    getField(getField(root, 'data'), 'blocks'),
    getField(getField(root, 'result'), 'blocks'),
    getField(root, 'logs'),
    getField(getField(root, 'output'), 'logs'),
    getField(root, 'output'),
    getField(root, 'result'),
    getField(root, 'data'),
    root,
  ];
}

/** Resolves a named block from a container — keyed object shape or array-of-entries shape. */
function findNamedBlock(container: unknown, name: string): unknown {
  if (!container || typeof container !== 'object') return undefined;

  // Shape A: object keyed by block name — blocks["Present Cards"]
  const keyed = getField(container, name);
  if (keyed !== undefined && keyed !== null) return keyed;

  // Shape B: array of block entries with a name-ish field.
  if (Array.isArray(container)) {
    for (const item of container) {
      const itemName =
        asText(getField(item, 'name')) ??
        asText(getField(item, 'blockName')) ??
        asText(getField(item, 'block')) ??
        asText(getField(item, 'title')) ??
        asText(getField(item, 'label'));
      if (itemName && itemName.toLowerCase() === name.toLowerCase()) {
        return item;
      }
    }
  }
  return undefined;
}

/**
 * Reads per-block outputs from the execute response. Block outputs may live
 * under json.blocks / json.output.blocks / json.logs / json.data.blocks —
 * both as an object keyed by block name and as an array of
 * { name|blockName|title, content|output } entries. Returns the FIRST
 * non-empty agent text in priority order, explicitly skipping table statuses.
 */
export function pickAgentBlockContent(root: unknown): string | undefined {
  const containers = blockContainers(root);
  for (const name of AGENT_BLOCK_NAMES) {
    for (const container of containers) {
      const block = findNamedBlock(container, name);
      const text = blockText(block);
      if (text) return text;
    }
  }
  return undefined;
}

/**
 * Generic multi-branch pick. Each terminal agent returns its visible text in
 * a `content` field — but the search branch also carries a structured object
 * { mode, selected_ids, candidates, message } where the visible text lives
 * under `message`. The execute API wraps it differently per branch. Returns
 * the FIRST text found under any of the known shapes, skipping table-status
 * strings like "Row updated successfully".
 */
export function pickWorkflowMessage(o: unknown): string | undefined {
  return (
    asMessageText(getField(getField(o, 'output'), 'content')) ??
    asMessageText(getField(getField(getField(o, 'data'), 'output'), 'content')) ??
    asMessageText(getField(getField(o, 'output'), 'message')) ??
    asMessageText(getField(getField(getField(o, 'data'), 'output'), 'message')) ??
    asMessageText(getField(o, 'output')) ??
    asMessageText(getField(o, 'content')) ??
    asMessageText(getField(o, 'message')) ??
    asMessageText(getField(getField(o, 'result'), 'content')) ??
    asMessageText(getField(getField(o, 'result'), 'message')) ??
    asMessageText(getField(getField(o, 'data'), 'content')) ??
    asMessageText(getField(getField(o, 'data'), 'message')) ??
    asMessageText(getField(getField(o, 'result'), 'reply')) ??
    asMessageText(getField(o, 'reply')) ??
    asMessageText(o)
  );
}

/**
 * Recursively extracts the user-facing text from the workflow response.
 * Priority: an object's own `reply` field, then its own `content` and
 * `message` string fields (the structured search-turn object
 * { mode, candidates, message } keeps its visible text under `message`),
 * then the well-known container keys (result, output, content, data,
 * message), then plain-string output/content/message fields (only when they
 * don't look like internal state or table statuses), then a generic
 * depth-limited scan. JSON embedded inside strings is parsed and searched
 * too. Returns null when nothing user-facing is found so the API route can
 * show its friendly failure copy instead.
 */
function extractReplyFromValue(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return extractReplyFromValue(parsed, depth + 1);
      } catch {
        return null;
      }
    }
    // Bare strings are never returned on their own at this level — only
    // whitelisted fields (reply / output / content / message) may surface text.
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractReplyFromValue(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    // Structured contract: { reply, mode, cardCount }
    const ownReply = record['reply'];
    if (typeof ownReply === 'string' && ownReply.trim() && !isTableStatus(ownReply)) {
      return ownReply.trim();
    }

    // Multi-branch contract: the ending agent's text lives in `content`.
    const ownContent = record['content'];
    if (
      typeof ownContent === 'string' &&
      ownContent.trim() &&
      !isTableStatus(ownContent) &&
      !looksLikeInternalPayload(ownContent)
    ) {
      return ownContent.trim();
    }

    // Structured search-turn object: { mode, selected_ids, candidates, message }
    // — the user-facing text is the `message` string.
    const ownMessage = record['message'];
    if (
      typeof ownMessage === 'string' &&
      ownMessage.trim() &&
      !isTableStatus(ownMessage) &&
      !looksLikeInternalPayload(ownMessage)
    ) {
      return ownMessage.trim();
    }

    // Well-known containers, in priority order.
    for (const key of ['result', 'output', 'content', 'message', 'data'] as const) {
      if (key in record) {
        const found = extractReplyFromValue(record[key], depth + 1);
        if (found) return found;
      }
    }

    // Plain-string fallbacks (data.output ?? data.content ?? data.message).
    for (const key of ['output', 'content', 'message'] as const) {
      const raw = record[key];
      if (
        typeof raw === 'string' &&
        raw.trim() &&
        !isTableStatus(raw) &&
        !looksLikeInternalPayload(raw)
      ) {
        return raw.trim();
      }
    }

    // Generic depth-limited scan of remaining children.
    for (const child of Object.values(record)) {
      const found = extractReplyFromValue(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  return null;
}

export function extractReply(value: unknown): string | null {
  return extractReplyFromValue(value);
}

function parseSseChunks(raw: string): unknown[] {
  const chunks: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean.startsWith('data:')) continue;
    const payload = clean.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      chunks.push(JSON.parse(payload) as unknown);
    } catch {
      // Non-JSON stream noise is internal — never shown to the user.
    }
  }
  return chunks;
}

export function parseWorkflowResponse(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // SSE-stream fallback: some workflow deployments still answer with
  // `data:` chunks. Scan them newest-first for a usable message.
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
    const newestFirst = parseSseChunks(trimmed).slice().reverse();
    for (const chunk of newestFirst) {
      const agent = pickAgentBlockContent(chunk);
      if (agent) return agent;
      const picked = pickWorkflowMessage(chunk);
      if (picked && !looksLikeInternalPayload(picked)) return picked;
    }
    return extractReply(newestFirst);
  }

  // Standard path: plain JSON body. Prefer the NAMED AGENT blocks (Format
  // Export → Apollo Contact Finder → Present Cards) so trailing table-status
  // strings never win, then the generic multi-branch shapes, then a
  // recursive depth-limited scan.
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const agent = pickAgentBlockContent(parsed);
    if (agent) return agent;
    const picked = pickWorkflowMessage(parsed);
    if (picked && !looksLikeInternalPayload(picked)) return picked;
    return extractReply(parsed);
  } catch {
    // Not JSON at all — a bare prose body is acceptable as long as it isn't
    // internal plumbing.
    if (!looksLikeInternalPayload(trimmed) && !isTableStatus(trimmed)) {
      return trimmed;
    }
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Structured candidates (Identify block / combined search payload)    */
/* ------------------------------------------------------------------ */

/** Accepts only http(s) URLs — never emails or phone-looking strings. */
function asHttpUrl(value: unknown): string | undefined {
  const text = asText(value);
  if (!text) return undefined;
  if (!/^https?:\/\//i.test(text)) return undefined;
  if (text.includes('@')) return undefined;
  return text;
}

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (n >= 1) return n;
  }
  return undefined;
}

/** Normalizes confidence to a compact badge string, e.g. 0.92 / 92 / "92%" → "92%". */
function normalizeConfidence(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const pct = value > 0 && value <= 1 ? Math.round(value * 100) : Math.round(value);
    return pct >= 0 && pct <= 100 ? `${pct}%` : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    const t = value.trim();
    if (t.endsWith('%')) return t;
    const num = Number(t);
    if (Number.isFinite(num)) {
      const pct = num > 0 && num <= 1 ? Math.round(num * 100) : Math.round(num);
      return pct >= 0 && pct <= 100 ? `${pct}%` : t;
    }
    return t; // qualitative values like "High" pass through
  }
  return undefined;
}

/**
 * Maps one raw Identify candidate — { id, name, title, company, location,
 * seniority_level, confidence, linkedin_url, photo_url, summary } — into the
 * UI's CandidateCard shape. Tolerates camelCase variants. Requires a name.
 * Never surfaces emails or phones (none exist at this stage anyway).
 */
function toCandidateCard(item: unknown, fallbackIndex: number): CandidateCard | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const name = asText(rec['name']) ?? asText(rec['full_name']) ?? asText(rec['fullName']);
  if (!name) return null;

  const id =
    asPositiveInt(rec['id']) ?? asPositiveInt(rec['candidate_id']) ?? asPositiveInt(rec['candidateId']);
  const index = asPositiveInt(rec['index']) ?? id ?? fallbackIndex + 1;

  return {
    index,
    id,
    name,
    title: asText(rec['title']) ?? asText(rec['job_title']) ?? asText(rec['jobTitle']) ?? '',
    company:
      asText(rec['company']) ??
      asText(rec['company_name']) ??
      asText(rec['companyName']) ??
      asText(rec['organization']) ??
      '',
    linkedin:
      asHttpUrl(rec['linkedin_url']) ?? asHttpUrl(rec['linkedinUrl']) ?? asHttpUrl(rec['linkedin']),
    location: asText(rec['location']),
    seniority:
      asText(rec['seniority_level']) ?? asText(rec['seniorityLevel']) ?? asText(rec['seniority']),
    confidence: normalizeConfidence(
      rec['confidence'] ?? rec['confidence_score'] ?? rec['confidenceScore'] ?? rec['match_confidence'],
    ),
    photoUrl:
      asHttpUrl(rec['photo_url']) ??
      asHttpUrl(rec['photoUrl']) ??
      asHttpUrl(rec['photo']) ??
      asHttpUrl(rec['avatar_url']),
    summary: asText(rec['summary']) ?? asText(rec['headline']),
  };
}

function mapCandidateArray(value: unknown): CandidateCard[] {
  if (!Array.isArray(value)) return [];
  const out: CandidateCard[] = [];
  value.forEach((item, i) => {
    const card = toCandidateCard(item, i);
    if (card) out.push(card);
  });
  return out.slice(0, 10);
}

/**
 * Depth-limited recursive scan for the FIRST usable `candidates` array
 * anywhere in the payload — this covers the combined search-branch object
 * { mode, selected_ids, candidates, message } under any wrapper (result /
 * output / data / blocks) AND candidates arrays embedded as JSON strings.
 */
function findCandidates(value: unknown, depth: number): CandidateCard[] {
  if (depth > 7 || value === null || value === undefined) return [];

  if (typeof value === 'string') {
    const t = value.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return findCandidates(JSON.parse(t) as unknown, depth + 1);
      } catch {
        return [];
      }
    }
    return [];
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCandidates(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  if (typeof value === 'object') {
    const own = mapCandidateArray(getField(value, 'candidates'));
    if (own.length > 0) return own;
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findCandidates(child, depth + 1);
      if (found.length > 0) return found;
    }
  }

  return [];
}

/** Candidate sources on a single block: block.candidates, block.output.candidates, JSON-string content. */
function blockCandidates(block: unknown): CandidateCard[] {
  if (block === undefined || block === null) return [];
  const direct = mapCandidateArray(getField(block, 'candidates'));
  if (direct.length > 0) return direct;
  const fromOutput = mapCandidateArray(getField(getField(block, 'output'), 'candidates'));
  if (fromOutput.length > 0) return fromOutput;
  const fromContentObj = mapCandidateArray(getField(getField(block, 'content'), 'candidates'));
  if (fromContentObj.length > 0) return fromContentObj;
  // content / output may themselves be JSON strings holding { candidates: [...] }
  for (const key of ['content', 'output', 'message'] as const) {
    const text = asText(getField(block, key));
    if (text && (text.startsWith('{') || text.startsWith('['))) {
      try {
        const parsed: unknown = JSON.parse(text);
        const cards = findCandidates(parsed, 0);
        if (cards.length > 0) return cards;
      } catch {
        // not JSON — ignore
      }
    }
  }
  return [];
}

/**
 * Reads the Identify block's per-block output — Identify.candidates holds the
 * structured card array ({ id, name, title, company, location,
 * seniority_level, confidence, linkedin_url, photo_url, summary }) even when
 * the visible message comes from Present Cards.content.
 */
export function pickIdentifyCandidates(root: unknown): CandidateCard[] {
  const containers = blockContainers(root);
  for (const container of containers) {
    const block = findNamedBlock(container, 'Identify');
    const cards = blockCandidates(block);
    if (cards.length > 0) return cards;
  }
  return [];
}

/**
 * Extracts structured candidates from the raw execute response. The visible
 * message (Present Cards.content) and the card data (Identify.candidates)
 * are SEPARATE in the payload — this reads BOTH shapes:
 *  1. a combined { message, candidates } object on the search branch (found
 *     via a recursive scan under any wrapper), or
 *  2. the Identify block's per-block output candidates array.
 * Returns [] on non-search turns so enrich/export replies stay pure Markdown.
 */
export function extractWorkflowCandidates(raw: string): CandidateCard[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const roots: unknown[] = [];
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
    roots.push(...parseSseChunks(trimmed).slice().reverse());
  } else {
    try {
      roots.push(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  }

  for (const root of roots) {
    // Preferred: combined { message, candidates } search-branch object.
    const combined = findCandidates(root, 0);
    if (combined.length > 0) return combined;
    // Fallback: explicit Identify per-block output.
    const identify = pickIdentifyCandidates(root);
    if (identify.length > 0) return identify;
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Error copy & redaction                                              */
/* ------------------------------------------------------------------ */

/** Builds user-facing copy for an upstream non-2xx response. */
export function describeWorkflowError(status: number, raw: string): string {
  let detail: string | undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    detail =
      asText(getField(parsed, 'error')) ??
      asText(getField(getField(parsed, 'error'), 'message')) ??
      asText(getField(parsed, 'message'));
  } catch {
    detail = undefined;
  }
  const suffix =
    detail && detail.length <= 200 && !looksLikeInternalPayload(detail) ? ` — ${detail}` : '';

  if (status === 401 || status === 403) {
    return `The search service rejected the request (HTTP ${status}, authorization${suffix}). Please try again in a moment.`;
  }
  if (status === 404) {
    return `The search service endpoint was not found (HTTP 404${suffix}). Please try again in a moment.`;
  }
  if (status === 429) {
    return `The search service is receiving too many requests right now (HTTP 429${suffix}). Please wait a few seconds and try again.`;
  }
  if (status === 504 || status === 502) {
    return `The search service timed out upstream (HTTP ${status}${suffix}). Deep searches can take several minutes — please try again.`;
  }
  if (status >= 500) {
    return `The search service hit an internal error (HTTP ${status}${suffix}). Please try again in a moment.`;
  }
  return `The search service returned HTTP ${status}${suffix}. Please try again in a moment.`;
}

/**
 * Defense-in-depth: strips phone-number-looking sequences from any text
 * shown to the user. Emails are allowed (enrichment's whole point); phones
 * are never surfaced at any stage.
 */
export function redactPhones(text: string): string {
  return text
    .replace(/\+\d{8,15}\b/g, '[phone removed]')
    .replace(
      /(?:\+\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?|\b\d{2,4}[\s.\-])\d{3,4}[\s.\-]\d{3,4}\b/g,
      (match) => {
        const digits = match.replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 15 ? '[phone removed]' : match;
      },
    );
}
