import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import {
  extractCandidates,
  getProspectLensConfig,
  parseJsonLoose,
  readMessage,
  toContact,
  unwrapOutput,
} from '@/lib/prospect-lens-api';
import type { ProspectContact } from '@/lib/types';

export const dynamic = 'force-dynamic';
// Deep searches can legitimately run for minutes — give the function the
// maximum budget (also pinned in vercel.json).
export const maxDuration = 300;

// Abort the outbound fetch just under the 300s function budget so we ALWAYS
// return our own JSON instead of hitting a hard Vercel timeout with no body.
const UPSTREAM_ABORT_MS = 295_000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
    const query = typeof body?.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return NextResponse.json(
        { conversationId: '', contacts: [], message: 'Please enter a search query first.' },
        { status: 400 },
      );
    }
    if (query.length > 2000) {
      return NextResponse.json(
        {
          conversationId: '',
          contacts: [],
          message: 'That query is a little long — could you shorten it and try again?',
        },
        { status: 400 },
      );
    }

    // A fresh conversationId per search. The workflow keys its stored
    // candidates on this value — it is returned to the client, which MUST
    // reuse it verbatim for every enrich call in this conversation.
    const conversationId = randomUUID();

    const { url, key } = getProspectLensConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_ABORT_MS);
    const started = Date.now();

    try {
      // Workflow contract: the Start block accepts ONLY `input` and
      // `conversationId`, wrapped in an `inputs` object. Auth via x-api-key.
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        body: JSON.stringify({ inputs: { input: query, conversationId } }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await res.text();
      console.log('PL identify timing', { ms: Date.now() - started, status: res.status });
      console.log('PL identify payload', res.status, raw.slice(0, 1500));

      const data = parseJsonLoose(raw) ?? {};
      // The execute API nests the workflow result under `output` — never read
      // candidates/message at the top level.
      const out = unwrapOutput(data);
      const message = readMessage(out);

      if (!res.ok) {
        return NextResponse.json(
          {
            conversationId,
            contacts: [],
            message:
              message ||
              `The search service returned HTTP ${res.status}. ${raw.slice(0, 300)}`,
          },
          { status: 502 },
        );
      }

      const contacts: ProspectContact[] = extractCandidates(out)
        .map((c, i) => toContact(c, i))
        .filter((c): c is ProspectContact => c !== null);

      if (contacts.length === 0 && !message) {
        // out was effectively empty — surface the actual payload snippet so
        // failures are debuggable instead of a generic "try again".
        return NextResponse.json(
          {
            conversationId,
            contacts: [],
            message: `The search completed (HTTP ${res.status}) but returned no candidates or message. Raw: ${raw.slice(0, 300)}`,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({ conversationId, contacts, message });
    } catch (err) {
      const aborted = controller.signal.aborted;
      console.error('PL identify fetch failed', {
        ms: Date.now() - started,
        abortedByUs: aborted,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        {
          conversationId,
          contacts: [],
          message: aborted
            ? 'The search ran longer than the 295-second budget and was stopped. Please try again or narrow the query.'
            : 'I could not reach the search service (network error). Please try again in a moment.',
        },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json(
      { conversationId: '', contacts: [], message: 'The search failed unexpectedly. Please try again.' },
      { status: 500 },
    );
  }
}
