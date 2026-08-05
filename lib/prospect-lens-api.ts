import type { EnrichedPerson, ProspectContact } from '@/lib/types';

/**
 * Prospect Lens workflow client helpers — the SINGLE source of truth for the
 * execute contract used by /api/identify and /api/enrich:
 *
 *   POST <PROSPECT_LENS_URL>
 *   headers: { 'x-api-key': <PROSPECT_LENS_API_KEY> }
 *   body:    { "inputs": { "input": "<string>", "conversationId": "<string>" } }
 *
 * The workflow's Start block accepts ONLY `input` and `conversationId` — there
 * is NO selectedId field. The execute API returns the workflow result nested
 * under `output`, so responses are always read as `data.output ?? data` and
 * fields (candidates, message, selected_details_json) are read on that
 * unwrapped object — never top-level.
 */

const DEFAULT_URL =
  'https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute';
const DEFAULT_KEY = 'sk-sim-WdwOSPQf0WHp5JiHs1jIGgj-kJ4ypP3q';

export interface ProspectLensConfig {
  url: string;
  key: string;
}

/** Resolves PROSPECT_LENS_URL / PROSPECT_LENS_API_KEY with hard defaults. */
export function getProspectLensConfig(): ProspectLensConfig {
  const url = process.env.PROSPECT_LENS_URL;
  const key = process.env.PROSPECT_LENS_API_KEY;
  return {
    url: url && url.trim() ? url.trim() : DEFAULT_URL,
    key: key && key.trim() ? key.trim() : DEFAULT_KEY,
  };
}

export function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getField(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * The execute API wraps the workflow result as { output: {...} }.
 * Always read `const out = data.output ?? data` — and if `output` arrives as
 * a JSON string, parse it first.
 */
export function unwrapOutput(data: unknown): unknown {
  const output = getField(data, 'output');
  if (output !== undefined && output !== null) {
    if (typeof output === 'string') {
      const parsed = parseJsonLoose(output);
      return parsed ?? output;
    }
    return output;
  }
  return data;
}

/** Reads out.message as a trimmed string ('' when absent). */
export function readMessage(out: unknown): string {
  const m = getField(out, 'message');
  return typeof m === 'string' ? m.trim() : '';
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeConfidence(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `${Math.round(v <= 1 ? v * 100 : v)}%`;
  }
  return asStr(v);
}

/** Coerces a value that may be an array OR a JSON-string-encoded array. */
function toArrayMaybeJson(value: unknown): unknown[] {
  let v: unknown = value;
  if (typeof v === 'string') v = parseJsonLoose(v);
  return Array.isArray(v) ? v : [];
}

/** Reads out.candidates (array or JSON string), with one nested-level fallback. */
export function extractCandidates(out: unknown): unknown[] {
  const direct = toArrayMaybeJson(getField(out, 'candidates'));
  if (direct.length > 0) return direct;
  const nested = toArrayMaybeJson(getField(getField(out, 'output'), 'candidates'));
  if (nested.length > 0) return nested;
  return toArrayMaybeJson(getField(getField(out, 'result'), 'candidates'));
}

/** Maps one raw workflow candidate onto the console's ProspectContact shape. */
export function toContact(rec: unknown, index: number): ProspectContact | null {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  const name = asStr(getField(rec, 'full_name')) || asStr(getField(rec, 'name'));
  if (!name) return null;
  const idRaw = getField(rec, 'id');
  const id =
    typeof idRaw === 'number' && Number.isFinite(idRaw) && idRaw >= 1
      ? Math.floor(idRaw)
      : index + 1;
  return {
    id,
    full_name: name,
    title: asStr(getField(rec, 'title')),
    company_name: asStr(getField(rec, 'company_name')) || asStr(getField(rec, 'company')),
    location: asStr(getField(rec, 'location')),
    seniority: asStr(getField(rec, 'seniority')) || asStr(getField(rec, 'seniority_level')),
    confidence: normalizeConfidence(getField(rec, 'confidence')),
    linkedin_url: asStr(getField(rec, 'linkedin_url')) || asStr(getField(rec, 'linkedin')),
    photo_url: asStr(getField(rec, 'photo_url')),
    work_email: '',
    status: 'identified',
  };
}

/**
 * Reads enriched people from out.selected_details_json (array or JSON string),
 * falling back to out.candidates, pulling work_email for each entry.
 */
export function toEnrichedPeople(out: unknown): EnrichedPerson[] {
  let list = toArrayMaybeJson(getField(out, 'selected_details_json'));
  if (list.length === 0) list = toArrayMaybeJson(getField(out, 'candidates'));
  const results: EnrichedPerson[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const idRaw = getField(item, 'id');
    let id = i + 1;
    if (typeof idRaw === 'number' && Number.isFinite(idRaw) && idRaw >= 1) {
      id = Math.floor(idRaw);
    } else if (typeof idRaw === 'string' && /^\d{1,6}$/.test(idRaw.trim())) {
      const n = Number(idRaw.trim());
      if (n >= 1) id = n;
    }
    const name = asStr(getField(item, 'full_name')) || asStr(getField(item, 'name'));
    const emailRaw = asStr(getField(item, 'work_email')) || asStr(getField(item, 'email'));
    const email = emailRaw.includes('@') ? emailRaw : '';
    results.push({
      id,
      full_name: name,
      work_email: email,
      status: email ? 'enriched' : 'no_email',
    });
  });
  return results;
}
