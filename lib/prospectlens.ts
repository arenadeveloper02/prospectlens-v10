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

/**
 * Reads per-block outputs from the execute response. Block outputs may live
 * under json.blocks / json.output.blocks / json.logs / json.data.blocks —
 * both as an object keyed by block name and as an array of
 * { name|blockName|title, content|output } entries. Returns the FIRST
 * non-empty agent text in priority order, explicitly skipping table statuses.
 */
export function pickAgentBlockContent(root: unknown): string | undefined {
  const containers: unknown[] = [
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

  for (const name of AGENT_BLOCK_NAMES) {
    for (const container of containers) {
      if (!container || typeof container !== 'object') continue;

      // Shape A: object keyed by block name — blocks["Present Cards"].content
      const keyed = getField(container, name);
      const keyedText = blockText(keyed);
      if (keyedText) return keyedText;

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
            const text = blockText(item);
            if (text) return text;
          }
        }
      }
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
  // strings never win, then fall back to the generic multi-branch pick and
  // finally the recursive scan.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not JSON at all — a bare prose body may be the answer itself.
    return !looksLikeInternalPayload(trimmed) && !isTableStatus(trimmed) ? trimmed : null;
  }
  const agent = pickAgentBlockContent(parsed);
  if (agent) return agent;
  const picked = pickWorkflowMessage(parsed);
  if (picked && !looksLikeInternalPayload(picked)) return picked;
  return extractReply(parsed);
}

/* ------------------------------------------------------------------ */
/*  Structured candidates — Identify.candidates[]                      */
/* ------------------------------------------------------------------ */

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value.trim()))) {
    return Number(value.trim());
  }
  return undefined;
}

/** Normalizes confidence (0.92, 92, "92%", "high") into badge text. */
function formatConfidence(value: unknown): string | undefined {
  const num = asNumber(value);
  if (num !== undefined) {
    const pct = num > 0 && num <= 1 ? Math.round(num * 100) : Math.round(num);
    if (pct >= 0 && pct <= 100) return `${pct}%`;
    return String(num);
  }
  return asText(value);
}

/**
 * Maps one Identify.candidates[] entry —
 * { id, name, title, company, location, seniority_level, confidence,
 *   linkedin_url, photo_url, summary } — into a CandidateCard. Email and
 * phone are NEVER read here: they don't exist at the search stage and must
 * never render on cards.
 */
function toCandidateCard(item: unknown, fallbackIndex: number): CandidateCard | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const name = asText(rec.name) ?? asText(rec.full_name) ?? asText(rec.fullName);
  if (!name) return null;
  const idNum = asNumber(rec.id) ?? asNumber(rec.index);
  const id = idNum !== undefined && idNum >= 1 ? Math.floor(idNum) : undefined;
  return {
    index: id ?? fallbackIndex,
    id,
    name,
    title: asText(rec.title) ?? asText(rec.role) ?? '',
    company: asText(rec.company) ?? asText(rec.organization) ?? '',
    linkedin: asText(rec.linkedin_url) ?? asText(rec.linkedinUrl) ?? asText(rec.linkedin),
    location: asText(rec.location),
    seniority: asText(rec.seniority_level) ?? asText(rec.seniorityLevel) ?? asText(rec.seniority),
    confidence: formatConfidence(rec.confidence),
    photoUrl: asText(rec.photo_url) ?? asText(rec.photoUrl),
    summary: asText(rec.summary),
  };
}

/**
 * Depth-limited walk that collects EVERY `candidates` array in the payload —
 * whether the workflow returns a combined { message, candidates } object on
 * the search branch, or the array lives on the Identify block's per-block
 * output (blocks / logs / output containers, keyed objects or arrays of
 * block entries). JSON embedded inside strings is parsed and searched too.
 */
function collectCandidateArrays(value: unknown, depth: number, out: CandidateCard[][]): void {
  if (depth > 8 || value === null || value === undefined) return;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        collectCandidateArrays(JSON.parse(trimmed) as unknown, depth + 1, out);
      } catch {
        // Not embedded JSON — ignore.
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectCandidateArrays(item, depth + 1, out);
    return;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const raw = record['candidates'];
    if (Array.isArray(raw)) {
      const cards: CandidateCard[] = [];
      raw.forEach((item, i) => {
        const card = toCandidateCard(item, i + 1);
        if (card) cards.push(card);
      });
      if (cards.length > 0) out.push(cards);
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'candidates') continue;
      collectCandidateArrays(child, depth + 1, out);
    }
  }
}

/**
 * Extracts structured candidates from the raw execute response. The visible
 * message (Present Cards.content) and the card data (Identify.candidates)
 * are SEPARATE — this reads the candidates array wherever it lives so the UI
 * can render one rich card per entry under the Present Cards heading.
 */
export function extractWorkflowCandidates(raw: string): CandidateCard[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const roots: unknown[] = [];
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
    roots.push(...parseSseChunks(trimmed));
  } else {
    try {
      roots.push(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  }

  const found: CandidateCard[][] = [];
  for (const root of roots) collectCandidateArrays(root, 0, found);
  if (found.length === 0) return [];

  // Prefer the richest array — the Identify block carries the full set.
  let best: CandidateCard[] = [];
  for (const cards of found) {
    if (cards.length > best.length) best = cards;
  }

  // Dedupe by id + name and cap at 10 cards.
  const seen = new Set<string>();
  const out: CandidateCard[] = [];
  for (const card of best) {
    const key = `${card.id ?? card.index}-${card.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
    if (out.length >= 10) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Errors & redaction                                                 */
/* ------------------------------------------------------------------ */

/** Friendly, user-safe description of an upstream failure status. */
export function describeWorkflowError(status: number, raw: string): string {
  void raw; // full payload is logged server-side; never surfaced to the user
  if (status === 401 || status === 403) {
    return 'The search service rejected this request (authentication issue). Please try again in a moment.';
  }
  if (status === 404) {
    return 'The search service endpoint could not be found. Please try again in a moment.';
  }
  if (status === 429) {
    return 'The search service is handling a lot of requests right now. Please wait a few seconds and try again.';
  }
  if (status >= 500) {
    return `The search service hit an internal error (HTTP ${status}). Please try again in a moment.`;
  }
  return `The search service returned an unexpected response (HTTP ${status}). Please try again in a moment.`;
}

/**
 * Defense in depth: phone numbers must never reach the chat. Replaces
 * phone-like digit runs (8–15 digits with common separators) while leaving
 * URLs and ids untouched.
 */
export function redactPhones(text: string): string {
  return text.replace(
    /(^|[^\w/.=&-])(\+?\d[\d\s().-]{7,}\d)/g,
    (full: string, prefix: string, num: string) => {
      const digits = num.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) return `${prefix}[phone hidden]`;
      return full;
    },
  );
}
