const DEFAULT_API_URL =
  'https://agent.thearena.ai/api/workflows/93554407-b92d-4ec6-ba3c-be07be4c153b/execute';
const DEFAULT_API_KEY = 'sk-sim-CM-viQzIdS99ZG4oIMVwQbm1Q3GfgjUx';

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
 * Structured contract returned by the workflow:
 *   { reply: string, mode?: string, cardCount?: number }
 * usually wrapped as { result: { ... } } or { output: { ... } }.
 */
export interface WorkflowResult {
  reply: string;
  mode?: string;
  cardCount?: number;
}

/**
 * Recursively extracts the user-facing `reply` string from the workflow
 * response. Priority: an object's own `reply` field, then the well-known
 * container keys (result, output, content, data), then plain-string
 * output/content fields (only when they don't look like internal state),
 * then a generic depth-limited scan. JSON embedded inside strings is
 * parsed and searched too. Returns null when nothing user-facing is found
 * so the API route can show its friendly failure copy instead.
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
    // whitelisted fields (reply / output / content) may surface text.
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
    if (typeof ownReply === 'string' && ownReply.trim()) {
      return ownReply.trim();
    }

    // Well-known containers, in priority order.
    for (const key of ['result', 'output', 'content', 'data'] as const) {
      if (key in record) {
        const found = extractReplyFromValue(record[key], depth + 1);
        if (found) return found;
      }
    }

    // Plain-string output/content fallbacks (data.output ?? data.content).
    for (const key of ['output', 'content'] as const) {
      const raw = record[key];
      if (typeof raw === 'string' && raw.trim() && !looksLikeInternalPayload(raw)) {
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

export function parseWorkflowResponse(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // SSE-stream fallback: some workflow deployments still answer with
  // `data:` chunks. Scan them newest-first for a usable reply.
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
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
    return extractReply(chunks.slice().reverse());
  }

  // Standard path: plain JSON body with { result: { reply, mode, cardCount } }
  // (or output/content variants).
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return extractReply(parsed);
  } catch {
    return null;
  }
}

/**
 * Defense in depth: even an extracted reply could, in a bad workflow run,
 * contain raw JSON or internal debug state. Any reply that parses as JSON
 * or contains known internal field names is treated as unusable so the
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
