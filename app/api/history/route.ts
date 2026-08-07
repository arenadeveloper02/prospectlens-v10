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
 * { message, candidates_json (JSON string), conversation_id, email,
 *   updated_at }. The session email comes from the Arena cookie set by
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
  const statusRaw = asStr(rec['status']).toLowerCase();
  const status: ProspectStatus =
    email || statusRaw === 'enriched'
      ? 'enriched'
      : statusRaw === 'no_email'
        ? 'no_email'
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

export async function GET(request: NextRequest) {
  try {
    // The session email comes ONLY from the Arena cookie set by middleware.
    const email = request.cookies.get(ARENA_EMAIL_COOKIE_NAME)?.value?.trim() ?? '';
    if (!email) {
      return NextResponse.json(
        {
          sessions: [],
          message: 'No session email found — reload the page inside Arena.',
          error: 'no_email',
        },
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
        body: JSON.stringify({ email, stream: false, selectedOutputs: ['table1.rows'] }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await res.text();
      console.log('PL history timing', { ms: Date.now() - started, status: res.status });
      console.log('PL history payload', res.status, raw.slice(0, 1500));

      if (!res.ok) {
        return NextResponse.json(
          {
            sessions: [],
            message: `The history service returned HTTP ${res.status}. Please try again in a moment.`,
            error: 'upstream_error',
          },
          { status: 502 },
        );
      }

      const data = parseJsonLoose(raw);
      const output = isRecord(data) ? data['output'] : undefined;
      const rowsRaw = isRecord(output) ? output['rows'] : undefined;
      const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

      const sessions: HistorySession[] = [];
      for (const row of rows) {
        if (!isRecord(row)) continue;
        const dRaw = row['data'];
        const d: Record<string, unknown> = isRecord(dRaw) ? dRaw : {};
        const conversationId = asStr(d['conversation_id']) || asStr(d['conversationId']);

        // candidates_json is a JSON string (occasionally already an array).
        let list: unknown[] = [];
        const candidatesRaw = d['candidates_json'];
        if (typeof candidatesRaw === 'string') {
          const parsed = parseJsonLoose(candidatesRaw);
          if (Array.isArray(parsed)) list = parsed;
        } else if (Array.isArray(candidatesRaw)) {
          list = candidatesRaw;
        }
        const contacts = list
          .map((c, i) => toHistoryContact(c, i))
          .filter((c): c is ProspectContact => c !== null);

        sessions.push({
          rowId: asStr(row['id']) || conversationId || `row-${sessions.length + 1}`,
          conversationId,
          email: asStr(d['email']),
          message: asStr(d['message']),
          updatedAt:
            asStr(d['updated_at']) || asStr(d['last_updated']) || asStr(row['updatedAt']),
          contacts,
        });
      }

      // Newest first.
      sessions.sort((a, b) => {
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
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
          message: aborted
            ? 'Loading history took too long and was stopped. Please try again.'
            : 'Could not reach the history service (network error). Please try again in a moment.',
          error: 'upstream_unreachable',
        },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json(
      { sessions: [], message: 'History failed unexpectedly. Please try again.', error: 'unknown' },
      { status: 500 },
    );
  }
}
