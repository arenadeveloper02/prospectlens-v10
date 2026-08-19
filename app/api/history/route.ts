import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProspectLensConfig, parseJsonLoose } from '@/lib/prospect-lens-api';
import { ARENA_EMAIL_COOKIE_NAME } from '@/lib/arena-email-constants';
import type { HistorySession, ProspectContact, ProspectStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Chat-history workflow contract:
 *
 *   POST https://agent.thearena.ai/api/workflows/85c915ed-.../execute
 *   headers: { 'X-API-Key': <PROSPECT_LENS_API_KEY> }
 *   body:    { "email": "<session email>", "stream": false, "selectedOutputs": ["table1.rows"] }
 *
 * The response nests rows at output.rows[] — each row's `data` carries
 * { message, candidates_json, selected_details_json, enrich_status,
 *   conversation_id, email, updated_at }. selected_details_json[].enrich_status
 * of "enriched" marks that contact as already enriched (checkbox disabled).
 * middleware — never from the client body.
 */
const DEFAULT_HISTORY_URL =
  'https://agent.thearena.ai/api/workflows/85c915ed-d7fc-4d76-ab1e-c1a93ca163ba/execute';

const UPSTREAM_ABORT_MS = 55_000;

function historyUrl(): string {
  const env = process.env.PROSPECT_LENS_HISTORY_URL;
  return env && env.trim() ? env.trim() : DEFAULT_HISTORY_URL;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function readCandidateStatus(rec: Record<string, unknown>): string {
  const raw = rec['status'] ?? rec['enrich_status'] ?? rec['enrichment_status'] ?? rec['enrichmentStatus'];
  if (typeof raw === 'string') return raw.trim().toLowerCase();
  if (isRecord(raw)) {
    return asStr(raw['value'] ?? raw['status'] ?? raw['label']).toLowerCase();
  }
  return asStr(raw).toLowerCase();
}

function isEnrichedStatus(status: string): boolean {
  return status === 'enriched' || status.includes('enriched');
}

/**
 * Maps one raw candidate from a stored candidates_json entry onto the
 * console's ProspectContact shape — unlike the identify mapper, this one
 * PRESERVES any stored work_email/status so enriched history sessions keep
 * their verified emails.
 */
function toHistoryContact(rec: unknown, index: number): ProspectContact | null {
  if (!isRecord(rec)) return null;
  const name = asStr(rec['full_name']) || asStr(rec['name']);
  if (!name) return null;
  const idRaw = rec['id'];
  const id =
    typeof idRaw === 'number' && Number.isFinite(idRaw) && idRaw >= 1
      ? Math.floor(idRaw)
      : index + 1;
  const confRaw = rec['confidence'];
  const confidence =
    typeof confRaw === 'number' && Number.isFinite(confRaw)
      ? `${Math.round(confRaw <= 1 ? confRaw * 100 : confRaw)}%`
      : asStr(confRaw);
  // Apollo-only, never guessed — anything without an '@' is discarded.
  const emailRaw =
    asStr(rec['work_email']) || asStr(rec['personal_email']) || asStr(rec['email']);
  const email = emailRaw.includes('@') ? emailRaw : '';
  const statusRaw = readCandidateStatus(rec);
  const status: ProspectStatus = isEnrichedStatus(statusRaw)
    ? 'enriched'
    : statusRaw === 'no_email' || statusRaw === 'no_email_found'
      ? 'no_email'
      : email
        ? 'enriched'
        : 'identified';
  return {
    id,
    full_name: name,
    title: asStr(rec['title']),
    company_name: asStr(rec['company_name']) || asStr(rec['company']),
    location: asStr(rec['location']),
    seniority: asStr(rec['seniority']) || asStr(rec['seniority_level']),
    confidence,
    linkedin_url: asStr(rec['linkedin_url']) || asStr(rec['linkedin']),
    photo_url: asStr(rec['photo_url']),
    work_email: email,
    status,
  };
}

/** Coerces a value that may be an array OR a JSON-string-encoded array. */
function toArrayMaybeJson(value: unknown): unknown[] {
  let v: unknown = value;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    v = parseJsonLoose(v) ?? v;
  }
  if (Array.isArray(v)) return v;
  if (isRecord(v)) {
    const nested = v['candidates'] ?? v['contacts'] ?? v['candidates_json'];
    if (nested !== undefined && nested !== v) return toArrayMaybeJson(nested);
    const vals = Object.values(v);
    if (vals.length > 0 && vals.every((item) => isRecord(item))) return vals;
  }
  return [];
}

/**
 * Walks ANY wrapper shape (output nesting, table1.rows keying, JSON embedded
 * in strings) and returns the FIRST rows[] array found — each entry being a
 * row object with an id + data payload.
 */
function extractRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  const seen = new Set<object>();
  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (!Array.isArray(node)) {
      const rec = node as Record<string, unknown>;
      for (const key of ['rows', 'table1.rows'] as const) {
        const rows = toArrayMaybeJson(rec[key]);
        if (rows.length > 0 && rows.every((r) => isRecord(r))) {
          return rows.filter(isRecord);
        }
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') {
        stack.push(v);
      } else if (typeof v === 'string') {
        const t = v.trim();
        if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
          const parsed = parseJsonLoose(t);
          if (parsed && typeof parsed === 'object') stack.push(parsed);
        }
      }
    }
  }
  return [];
}

/** Maps one history table row onto the HistorySession shape. */
function toSession(row: Record<string, unknown>, index: number): HistorySession | null {
  const dataRaw = row['data'];
  const data: Record<string, unknown> = isRecord(dataRaw)
    ? dataRaw
    : typeof dataRaw === 'string' && isRecord(parseJsonLoose(dataRaw))
      ? (parseJsonLoose(dataRaw) as Record<string, unknown>)
      : {};
  const rowId = asStr(row['id']) || asStr(data['id']) || `row-${index + 1}`;
  const conversationId =
    asStr(data['conversation_id']) || asStr(data['conversationId']) || asStr(row['conversation_id']);
  const email = asStr(data['email']);
  const message = asStr(data['message']);
  const updatedAt =
    asStr(data['updated_at']) ||
    asStr(data['last_updated']) ||
    asStr(row['updatedAt']) ||
    asStr(row['updated_at']);
  const candidatesRaw = toArrayMaybeJson(
    data['candidates_json'] ?? data['candidates'] ?? data['contacts'],
  );
  const selectedDetails = toArrayMaybeJson(data['selected_details_json']);
  const contacts: ProspectContact[] = [];
  candidatesRaw.forEach((c, i) => {
    const contact = toHistoryContact(c, i);
    if (contact) contacts.push(contact);
  });
  // If identify candidates are missing, still surface people from selected_details_json.
  if (contacts.length === 0) {
    selectedDetails.forEach((c, i) => {
      const contact = toHistoryContact(c, i);
      if (contact) contacts.push(contact);
    });
  }

  const detailsById = new Map<number, Record<string, unknown>>();
  const detailsByName = new Map<string, Record<string, unknown>>();
  for (const item of selectedDetails) {
    if (!isRecord(item)) continue;
    const idRaw = item['id'];
    if (typeof idRaw === 'number' && Number.isFinite(idRaw) && idRaw >= 1) {
      detailsById.set(Math.floor(idRaw), item);
    }
    const name = (asStr(item['name']) || asStr(item['full_name'])).toLowerCase();
    if (name) detailsByName.set(name, item);
  }

  const rowSelectedName = asStr(data['selected_name']).toLowerCase();
  const rowEnrichStatus = readCandidateStatus(data);
  const rowWorkEmail = asStr(data['work_email']);

  const merged = contacts.map((c) => {
    const hit = detailsById.get(c.id) ?? detailsByName.get(c.full_name.toLowerCase());
    const detailStatus = hit ? readCandidateStatus(hit) : '';
    const detailEmailRaw =
      (hit && (asStr(hit['work_email']) || asStr(hit['personal_email']) || asStr(hit['email']))) ||
      '';
    const detailEmail = detailEmailRaw.includes('@') ? detailEmailRaw : '';
    const nameMatchesRow = Boolean(rowSelectedName) && c.full_name.toLowerCase() === rowSelectedName;
    const enriched =
      isEnrichedStatus(detailStatus) ||
      (isEnrichedStatus(rowEnrichStatus) && (nameMatchesRow || (contacts.length === 1 && !hit)));
    const email =
      detailEmail ||
      c.work_email ||
      (enriched && nameMatchesRow && rowWorkEmail.includes('@') ? rowWorkEmail : '');
    return {
      ...c,
      work_email: email,
      status: (enriched ? 'enriched' : c.status) as ProspectStatus,
    };
  });

  if (!conversationId && merged.length === 0 && !message) return null;
  return { rowId, conversationId, email, message, updatedAt, contacts: merged };
}

export async function GET(request: NextRequest) {
  // Session email from the Arena cookie (set by middleware) — the history
  // workflow keys its rows on it. Never taken from the client body.
  const emailId = request.cookies.get(ARENA_EMAIL_COOKIE_NAME)?.value?.trim() ?? '';
  if (!emailId) {
    return NextResponse.json(
      { sessions: [], message: '', error: 'Missing session email.' },
      { status: 401 },
    );
  }

  const { key } = getProspectLensConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_ABORT_MS);
  const started = Date.now();

  try {
    const res = await fetch(historyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({
        email: emailId,
        stream: false,
        selectedOutputs: ['table1.rows'],
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const raw = await res.text();
    console.log('PL history timing', { ms: Date.now() - started, status: res.status });

    if (!res.ok) {
      return NextResponse.json(
        {
          sessions: [],
          message: `History service error (${res.status}).`,
          error: `history_upstream_${res.status}`,
        },
        { status: 502 },
      );
    }

    console.log('PL history raw', raw);
    const data = parseJsonLoose(raw) ?? {};
    const rows = extractRows(data);

    const sessions: HistorySession[] = [];
    rows.forEach((row, i) => {
      const session = toSession(row, i);
      if (session) sessions.push(session);
    });

    // Newest first — invalid/missing timestamps sink to the bottom.
    sessions.sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      const va = Number.isNaN(ta) ? 0 : ta;
      const vb = Number.isNaN(tb) ? 0 : tb;
      return vb - va;
    });

    return NextResponse.json({ sessions, message: '' });
  } catch (err) {
    const aborted = controller.signal.aborted;
    console.error('PL history fetch failed', {
      ms: Date.now() - started,
      abortedByUs: aborted,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        sessions: [],
        message: '',
        error: aborted
          ? 'The history request timed out. Please try again.'
          : 'Could not reach the history service. Please try again in a moment.',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
