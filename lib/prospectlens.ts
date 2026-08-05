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
      const msg = pickWorkflowMessage(chunk);
      if (msg && !looksLikeInternalPayload(msg)) return msg;
      const deep = extractReply(chunk);
      if (deep) return deep;
    }
    return null;
  }

  // Standard JSON execute response.
  try {
    const parsed: unknown = JSON.parse(trimmed);
    // Agent blocks first: Format Export → Apollo Contact Finder → Present Cards.
    const agent = pickAgentBlockContent(parsed);
    if (agent) return agent;
    const msg = pickWorkflowMessage(parsed);
    if (msg && !looksLikeInternalPayload(msg)) return msg;
    return extractReply(parsed);
  } catch {
    // Plain text response — usable only when it isn't internal plumbing.
    if (looksLikeInternalPayload(trimmed) || isTableStatus(trimmed)) return null;
    return trimmed;
  }
}

/* ------------------------------------------------------------------------ *
 * Structured candidates — parsed from the Identify block of the search turn.
 * Each item carries: id, name, title, company, company_domain, location,
 * seniority_level, confidence, photo_url, linkedin_url, summary.
 * The Present Cards agent text stays the lead-in message; these cards render
 * beneath it with avatar, badges, LinkedIn pill, and a numbered Select.
 * ------------------------------------------------------------------------ */

function isCandidateRecord(item: unknown): boolean {
  return (
    !!item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    ((item as Record<string, unknown>).name as string).trim().length > 0
  );
}

/** Direct `candidates` array on an object, validated to contain candidate-shaped rows. */
function candidatesArrayOf(value: unknown): unknown[] | null {
  const arr = getField(value, 'candidates');
  if (Array.isArray(arr) && arr.some(isCandidateRecord)) return arr;
  return null;
}

/**
 * Depth-limited recursive scan for a `candidates` array anywhere in the
 * payload — including inside JSON embedded in strings (agent `content`
 * fields sometimes carry the structured object as a serialized string).
 */
function findCandidatesArray(value: unknown, depth = 0): unknown[] | null {
  if (depth > 6 || value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return findCandidatesArray(JSON.parse(trimmed) as unknown, depth + 1);
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
    const direct = candidatesArrayOf(value);
    if (direct) return direct;
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findCandidatesArray(child, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function asStoredId(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 1) return Math.floor(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return n >= 1 ? n : undefined;
  }
  return undefined;
}

/** Normalizes confidence (0.92, 92, "0.92", "92", "92%") into "92%". */
function normalizeConfidence(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const pct = v <= 1 ? Math.round(v * 100) : Math.round(v);
    return pct > 0 && pct <= 100 ? `${pct}%` : undefined;
  }
  if (typeof v === 'string' && v.trim()) {
    const t = v.trim();
    if (t.endsWith('%')) return t;
    const n = Number(t);
    if (Number.isFinite(n)) {
      const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
      return pct > 0 && pct <= 100 ? `${pct}%` : undefined;
    }
    return t;
  }
  return undefined;
}

/**
 * Maps raw Identify rows into CandidateCard DTOs. Only identity fields are
 * surfaced — NEVER email or phone (none exists at this stage anyway).
 * `id` is the workflow's STORED candidate id: selecting a card sends exactly
 * this number back as the next input so the workflow can match it.
 */
function mapCandidates(items: unknown[]): CandidateCard[] {
  const out: CandidateCard[] = [];
  items.forEach((item, i) => {
    if (!isCandidateRecord(item)) return;
    const rec = item as Record<string, unknown>;
    const name = (rec.name as string).trim();
    out.push({
      index: i + 1,
      id: asStoredId(rec.id),
      name,
      title: asText(rec.title) ?? '',
      company: asText(rec.company) ?? '',
      linkedin: asText(rec.linkedin_url) ?? asText(rec.linkedinUrl) ?? asText(rec.linkedin),
      location: asText(rec.location),
      seniority: asText(rec.seniority_level) ?? asText(rec.seniorityLevel) ?? asText(rec.seniority),
      confidence: normalizeConfidence(rec.confidence),
      photoUrl: asText(rec.photo_url) ?? asText(rec.photoUrl),
      summary: asText(rec.summary),
    });
  });
  return out.slice(0, 10);
}

/**
 * Extracts structured candidates from the raw execute response.
 * Priority 1: the Identify block's own output — output["Identify"].candidates
 * (also blocks["Identify"], logs entries named "Identify", or an
 * array-of-blocks entry with name/blockName === "Identify").
 * Priority 2: any `candidates` array found in a generic depth-limited scan
 * (covers wrapper drift between deployments). Logs which source matched so
 * the exact path is verifiable in Vercel logs.
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
    // Priority 1: the Identify block.
    for (const container of blockContainers(root)) {
      const identify = findNamedBlock(container, 'Identify');
      if (identify === undefined || identify === null) continue;
      const arr =
        candidatesArrayOf(identify) ??
        candidatesArrayOf(getField(identify, 'output')) ??
        candidatesArrayOf(getField(identify, 'content')) ??
        findCandidatesArray(identify);
      if (arr && arr.length > 0) {
        const mapped = mapCandidates(arr);
        if (mapped.length > 0) {
          console.log('PL candidates source: Identify block', mapped.length);
          return mapped;
        }
      }
    }

    // Priority 2: generic scan for any candidates[] array.
    const arr = findCandidatesArray(root);
    if (arr && arr.length > 0) {
      const mapped = mapCandidates(arr);
      if (mapped.length > 0) {
        console.log('PL candidates source: generic scan', mapped.length);
        return mapped;
      }
    }
  }

  return [];
}

/**
 * Redacts phone-number-looking sequences (10–15 digits with typical phone
 * punctuation) from user-facing replies. Emails, short ids, years, and
 * percentages are untouched.
 */
export function redactPhones(text: string): string {
  return text.replace(/\+?\d[\d\s().\-]{8,}\d/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15 ? '[phone hidden]' : match;
  });
}

/** Friendly, status-aware description of an upstream workflow failure. */
export function describeWorkflowError(status: number, raw: string): string {
  let detail: string | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    detail =
      asText(getField(parsed, 'error')) ??
      asText(getField(parsed, 'message')) ??
      asText(getField(getField(parsed, 'error'), 'message')) ??
      null;
  } catch {
    detail = null;
  }
  if (status === 401 || status === 403) {
    return 'The search service rejected the request credentials. Please try again in a moment.';
  }
  if (status === 404) {
    return 'The search workflow could not be found. Please try again in a moment.';
  }
  if (status === 429) {
    return 'The search service is handling a lot of requests right now — please wait a few seconds and try again.';
  }
  if (status >= 500) {
    return 'The search service hit an internal error. Please try again in a moment.';
  }
  if (detail && !looksLikeInternalPayload(detail) && detail.length <= 300) {
    return `The search didn't complete: ${detail}. Please try again in a moment.`;
  }
  return `The search didn't complete (HTTP ${status}). Please try again in a moment.`;
}
