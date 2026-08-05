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

  // Shape A: object keyed by block name — blocks["Present Cards"] / output["Identify"]
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
      const found = extractReplyFromValue(chunk);
      if (found && !looksLikeInternalPayload(found)) return found;
    }
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const agent = pickAgentBlockContent(parsed);
    if (agent) return agent;
    const picked = pickWorkflowMessage(parsed);
    if (picked && !looksLikeInternalPayload(picked)) return picked;
    const found = extractReplyFromValue(parsed);
    if (found && !looksLikeInternalPayload(found)) return found;
    return null;
  } catch {
    // Plain-text response: usable as-is when it doesn't look like plumbing.
    if (!looksLikeInternalPayload(trimmed) && !isTableStatus(trimmed)) return trimmed;
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Structured candidates (Identify block)                              */
/* ------------------------------------------------------------------ */

function asUrl(value: unknown): string | undefined {
  const text = asText(value);
  return text && /^https?:\/\//i.test(text) ? text : undefined;
}

function asPickNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && /^\d{1,4}$/.test(value.trim())) {
    const n = Number(value.trim());
    return n >= 1 ? n : undefined;
  }
  return undefined;
}

/** Normalizes confidence values (0–1 float, 0–100 number, or string) to "92%". */
function normalizeConfidence(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const pct = value > 0 && value <= 1 ? Math.round(value * 100) : Math.round(value);
    return pct >= 0 && pct <= 100 ? `${pct}%` : undefined;
  }
  const text = asText(value);
  if (!text) return undefined;
  if (text.endsWith('%')) return text;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    const pct = n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
    return pct >= 0 && pct <= 100 ? `${pct}%` : text;
  }
  return text;
}

/**
 * Maps one raw Identify candidate (snake_case fields: id, name, title,
 * company, company_domain, location, seniority_level, confidence, photo_url,
 * linkedin_url, summary) into the UI's CandidateCard shape. Never surfaces
 * emails or phones — those don't exist at this stage and are not mapped.
 */
function normalizeCandidate(item: unknown, i: number): CandidateCard | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const name = asText(rec['name']) ?? asText(rec['full_name']);
  if (!name) return null;
  return {
    index: asPickNumber(rec['index']) ?? i + 1,
    id: asPickNumber(rec['id']),
    name,
    title: asText(rec['title']) ?? asText(rec['job_title']) ?? '',
    company: asText(rec['company']) ?? asText(rec['company_name']) ?? '',
    linkedin: asUrl(rec['linkedin_url']) ?? asUrl(rec['linkedin']),
    location: asText(rec['location']),
    seniority: asText(rec['seniority_level']) ?? asText(rec['seniority']),
    confidence: normalizeConfidence(rec['confidence']),
    photoUrl: asUrl(rec['photo_url']) ?? asUrl(rec['photoUrl']),
    summary: asText(rec['summary']),
  };
}

function normalizeCandidateList(list: unknown[] | null): CandidateCard[] {
  if (!list) return [];
  const out: CandidateCard[] = [];
  list.forEach((item, i) => {
    const card = normalizeCandidate(item, i);
    if (card) out.push(card);
  });
  return out.slice(0, 10);
}

/**
 * Depth-limited scan for a `candidates` array of objects-with-name anywhere
 * in the payload. Also parses JSON embedded inside strings, since agent
 * blocks often serialize their structured output as a JSON string.
 */
function findCandidatesArray(value: unknown, depth: number): unknown[] | null {
  if (depth > 8 || value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const t = value.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return findCandidatesArray(JSON.parse(t) as unknown, depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCandidatesArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const own = rec['candidates'];
    if (
      Array.isArray(own) &&
      own.length > 0 &&
      own.some(
        (c) =>
          c &&
          typeof c === 'object' &&
          !Array.isArray(c) &&
          typeof (c as Record<string, unknown>)['name'] === 'string',
      )
    ) {
      return own;
    }
    for (const child of Object.values(rec)) {
      const found = findCandidatesArray(child, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

/** Reads candidates from a specific block entry (object or JSON-string outputs). */
function candidatesFromBlock(block: unknown): CandidateCard[] {
  if (block === undefined || block === null) return [];
  const direct =
    getField(block, 'candidates') ??
    getField(getField(block, 'output'), 'candidates') ??
    getField(getField(block, 'content'), 'candidates');
  if (Array.isArray(direct)) {
    const cards = normalizeCandidateList(direct);
    if (cards.length > 0) return cards;
  }
  const found = findCandidatesArray(block, 0);
  return normalizeCandidateList(found);
}

/** Block names whose output carries the structured candidates array. */
const CANDIDATE_BLOCK_NAMES = ['Identify', 'Present Cards'] as const;

/**
 * Extracts the structured candidates array from the raw execute response.
 * Primary path: the Identify block's output — e.g. output["Identify"].candidates
 * or blocks[].{name:"Identify"}.output.candidates (each item: id, name, title,
 * company, company_domain, location, seniority_level, confidence, photo_url,
 * linkedin_url, summary). Falls back to a generic depth-limited scan for any
 * candidates[] array so wrapper-shape drift never hides the cards.
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
    // 1) Named blocks first — the Identify block owns the candidates array.
    for (const name of CANDIDATE_BLOCK_NAMES) {
      for (const container of blockContainers(root)) {
        const block = findNamedBlock(container, name);
        const cards = candidatesFromBlock(block);
        if (cards.length > 0) return cards;
      }
    }
    // 2) Generic recursive scan of the whole payload.
    const cards = normalizeCandidateList(findCandidatesArray(root, 0));
    if (cards.length > 0) return cards;
  }

  return [];
}

/* ------------------------------------------------------------------ */
/* Errors & redaction                                                  */
/* ------------------------------------------------------------------ */

/** Maps an upstream HTTP failure to friendly, debuggable copy. */
export function describeWorkflowError(status: number, raw: string): string {
  let detail: string | undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    detail = asText(getField(parsed, 'error')) ?? asText(getField(parsed, 'message'));
  } catch {
    detail = undefined;
  }
  if (status === 401 || status === 403) {
    return 'The search service rejected the request credentials. Please try again in a moment.';
  }
  if (status === 404) {
    return 'The search workflow endpoint was not found. Please try again in a moment.';
  }
  if (status === 429) {
    return 'The search service is handling a lot of requests right now — please wait a few seconds and try again.';
  }
  if (status >= 500) {
    return `The search service hit an internal error (HTTP ${status}). Please try again in a moment.`;
  }
  return detail && !looksLikeInternalPayload(detail)
    ? `The search service returned an error (HTTP ${status}): ${detail}`
    : `The search service returned an unexpected response (HTTP ${status}). Please try again in a moment.`;
}

/**
 * Defense-in-depth: phone numbers must never surface in the chat. Replaces
 * phone-looking digit runs (8+ digits with separators) with a redaction tag.
 */
export function redactPhones(text: string): string {
  return text.replace(/\+?\d[\d\s().-]{7,}\d/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 8 ? '[phone hidden]' : match;
  });
}
