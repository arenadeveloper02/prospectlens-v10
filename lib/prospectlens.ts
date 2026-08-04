const DEFAULT_API_URL =
  'https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute';
const DEFAULT_API_KEY = 'sk-sim-aqTqmPYK2VyFoSQGH5uHTOGsr-eiY2kD';

export const SELECTED_OUTPUTS: string[] = [
  'loadcandidates.success',
  'loadcandidates.rows',
  'serializecandidates.result',
  'serializeenriched.result',
  'saveenriched.success',
  'saveenriched.row',
  'loadallcontacts.success',
  'loadallcontacts.rows',
  'savecandidates.success',
  'savecandidates.row',
  'identify.candidates',
  'identify.message',
  'apollocontactfinder.content',
  'presentcards.content',
  'formatexport.content',
];

export interface WorkflowConfig {
  url: string;
  key: string;
}

export function getWorkflowConfig(): WorkflowConfig {
  const envUrl = process.env.PROSPECTLENS_API_URL;
  const envKey = process.env.PROSPECTLENS_API_KEY;
  return {
    url: envUrl && envUrl.trim() ? envUrl.trim() : DEFAULT_API_URL,
    key: envKey && envKey.trim() ? envKey.trim() : DEFAULT_API_KEY,
  };
}

/**
 * The ONLY workflow outputs that may ever be shown to the user, in strict
 * priority order. Everything else (serializecandidates.result,
 * serializeenriched.result, generic reply/content/result keys, streamed
 * chunk text, etc.) is internal workflow state and must NEVER surface in
 * the chat. If none of these fields are present, extractReply returns null
 * and the API route shows its friendly failure copy instead.
 */
const ALLOWED_OUTPUT_KEYS = [
  'presentcards.content',
  'formatexport.content',
  'apollocontactfinder.content',
  'identify.message',
] as const;

function findAllowedKey(value: unknown, key: string, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return findAllowedKey(parsed, key, depth + 1);
      } catch {
        return null;
      }
    }
    // Plain strings are never returned on their own — only whitelisted fields are.
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAllowedKey(item, key, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (key in record) {
      const raw = record[key];
      if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
      }
    }
    for (const child of Object.values(record)) {
      const found = findAllowedKey(child, key, depth + 1);
      if (found) return found;
    }
    return null;
  }
  return null;
}

export function extractReply(value: unknown): string | null {
  for (const key of ALLOWED_OUTPUT_KEYS) {
    const found = findAllowedKey(value, key);
    if (found) return found;
  }
  return null;
}

export function parseWorkflowResponse(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes('data:')) {
    const chunks: unknown[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
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
    // Prefer the most recent chunk that carries a whitelisted output field.
    return extractReply(chunks.slice().reverse());
  }

  return extractReply(trimmed);
}

/**
 * Defense in depth: even a whitelisted output field could, in a bad workflow
 * run, contain raw JSON or internal debug state. Any reply that parses as
 * JSON or contains known internal field names is treated as unusable so the
 * API route falls back to its friendly failure copy — internal workflow
 * state must never leak into the chat.
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
      // Not valid JSON — fall through to marker checks.
    }
  }
  const markers = ['"candidates":', '"conversation_id":', '"enrich_status":', '"selected_ids":'];
  return markers.some((marker) => trimmed.includes(marker));
}

export function redactPhones(text: string): string {
  return text
    .replace(/\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g, '[number withheld]')
    .replace(/\+\d{1,3}[\s.-]\d{3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '[number withheld]');
}
