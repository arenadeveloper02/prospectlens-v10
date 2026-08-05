import type { EnrichmentResult } from '@/lib/types';

/**
 * Parses enrichment outcomes ({ id, email, email_status }) out of the raw
 * workflow execute response. Pure response PARSING — no workflow logic.
 * Scans plain JSON bodies and SSE `data:` chunks, depth-limited, and also
 * unwraps JSON embedded inside strings. Only entries with a valid stored
 * candidate id AND at least an email or an email_status are returned, so
 * search-turn candidates (which carry neither) never produce false merges.
 */

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && /^\d{1,6}$/.test(value.trim())) {
    const n = Number(value.trim());
    return n >= 1 ? n : null;
  }
  return null;
}

export function extractEnrichments(raw: string): EnrichmentResult[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const roots: unknown[] = [];
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
    for (const line of trimmed.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean.startsWith('data:')) continue;
      const payload = clean.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      const parsed = parseJsonSafe(payload);
      if (parsed !== null) roots.push(parsed);
    }
  } else {
    const parsed = parseJsonSafe(trimmed);
    if (parsed !== null) roots.push(parsed);
  }

  const found = new Map<number, EnrichmentResult>();

  const visit = (value: unknown, depth: number): void => {
    if (depth > 8 || value === null || value === undefined) return;

    if (typeof value === 'string') {
      const t = value.trim();
      if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        const parsed = parseJsonSafe(t);
        if (parsed !== null) visit(parsed, depth + 1);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    if (typeof value === 'object') {
      const rec = value as Record<string, unknown>;
      const id = toId(rec['id'] ?? rec['candidate_id'] ?? rec['candidateId']);
      const emailRaw = rec['email'];
      const email =
        typeof emailRaw === 'string' && emailRaw.includes('@') && emailRaw.trim()
          ? emailRaw.trim()
          : undefined;
      const statusRaw = rec['email_status'] ?? rec['emailStatus'];
      const emailStatus =
        typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim() : undefined;

      if (id !== null && (email || emailStatus)) {
        const existing = found.get(id);
        // Prefer entries that actually carry an email over status-only ones.
        if (!existing || (email && !existing.email)) {
          found.set(id, { id, email, emailStatus });
        }
      }

      for (const child of Object.values(rec)) visit(child, depth + 1);
    }
  };

  for (const root of roots) visit(root, 0);
  return Array.from(found.values());
}
