import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getProspectLensConfig,
  parseJsonLoose,
  readMessage,
  unwrapOutput,
} from '@/lib/prospect-lens-api';
import type { ConsoleContact } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UPSTREAM_ABORT_MS = 295_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/**
 * Walks ANY wrapper shape (output nesting, row.data, JSON embedded in
 * strings) and returns the workflow's AUTHORITATIVE selected_details_json
 * array — falling back to a `results` array of objects when present.
 */
function extractDetails(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  const seen = new Set<object>();
  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (!Array.isArray(node)) {
      const rec = node as Record<string, unknown>;
      const direct = rec['selected_details_json'];
      if (Array.isArray(direct)) return direct.filter(isRecord);
      if (typeof direct === 'string') {
        const parsed = parseJsonLoose(direct);
        if (Array.isArray(parsed)) return parsed.filter(isRecord);
      }
      const results = rec['results'];
      if (Array.isArray(results) && results.length > 0 && results.every((r) => isRecord(r))) {
        return results.filter(isRecord);
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

/**
 * Selection-driven enrichment. The client sends `picks` — the 1-based card
 * positions exactly as displayed — plus the SAME conversationId returned by
 * /api/identify. The workflow's Selection Gate expects a BARE pick string as
 * `input` ("1" or "1, 3") — never a sentence, never a selectedId field. The
 * Start trigger takes a FLAT body: { input, conversationId } (no `inputs`
 * wrapper). Verified emails are read from selected_details_json[].work_email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      picks?: unknown;
      id?: unknown;
      selection?: unknown;
      conversationId?: unknown;
    } | null;

    const conversationId =
      body && typeof body.conversationId === 'string' ? body.conversationId.trim() : '';

    // 1-based positions from the UI; fall back to a single id or a legacy
    // bare selection string if that's all we got.
    let picks: number[] = [];
    if (body && Array.isArray(body.picks)) {
      picks = (body.picks as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.floor(n));
    } else if (body && body.id !== undefined && body.id !== null) {
      const n = Number(body.id);
      if (Number.isFinite(n) && n > 0) picks = [Math.floor(n)];
    } else if (body && typeof body.selection === 'string') {
      picks = body.selection
        .split(/[,\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0);
    }

    if (picks.length === 0) {
      return NextResponse.json({ error: 'Missing picks to enrich' }, { status: 400 });
    }
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId — enrich must reuse the id from the search call.' },
        { status: 400 },
      );
    }

    // The Selection Gate expects a BARE pick string: "1" or "1, 3".
    const input = picks.join(', ');

    const { url, key } = getProspectLensConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_ABORT_MS);
    const started = Date.now();

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        // FLAT Start-trigger contract: bare pick as `input`, the SAME
        // conversationId from the search turn, no selectedId, no `inputs`.
        body: JSON.stringify({ input, conversationId }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await res.text();
      console.log('PL enrich timing', { ms: Date.now() - started, status: res.status });
      console.log('PL enrich payload', res.status, raw.slice(0, 1500));

      if (!res.ok) {
        return NextResponse.json(
          { error: `Prospect Lens error (${res.status})`, detail: raw.slice(0, 500) },
          { status: 502 },
        );
      }

      const data = parseJsonLoose(raw) ?? {};
      // selected_details_json[] is the authoritative enrichment payload.
      const people = extractDetails(data);

      const contacts: ConsoleContact[] = people.map((p) => {
        const emailRaw =
          asStr(p['work_email']) || asStr(p['email']) || asStr(p['personal_email']);
        // Apollo-only, never guessed — anything without an '@' is discarded.
        const email = emailRaw.includes('@') ? emailRaw : '';
        return {
          id: asStr(p['id']) || asStr(p['candidate_id']),
          full_name: asStr(p['name']) || asStr(p['full_name']),
          title: asStr(p['title']),
          company_name: asStr(p['company']) || asStr(p['company_name']),
          company_domain: asStr(p['company_domain']) || asStr(p['domain']),
          location: asStr(p['location']),
          linkedin_url: asStr(p['linkedin_url']),
          work_email: email,
          email_status: email ? (asStr(p['email_type']) === 'personal' ? 'personal' : 'verified') : '',
          email_deliverable: email ? true : null,
          status: email ? 'enriched' : 'no_email_found',
        };
      });

      const enriched = contacts.filter((c) => c.work_email).length;
      const out = unwrapOutput(data);
      const message = readMessage(out) || readMessage(data);

      return NextResponse.json({
        contacts,
        enriched,
        offTarget: 0,
        unmatched: contacts.length - enriched,
        message,
      });
    } catch (err) {
      const aborted = controller.signal.aborted;
      console.error('PL enrich fetch failed', {
        ms: Date.now() - started,
        abortedByUs: aborted,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        {
          contacts: [],
          enriched: 0,
          offTarget: 0,
          unmatched: 0,
          message: '',
          error: aborted
            ? 'The enrichment ran longer than the 295-second budget and was stopped. Please try again.'
            : 'Could not reach the enrichment service (network error). Please try again in a moment.',
        },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'enrich failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
