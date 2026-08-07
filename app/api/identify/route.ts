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
import { ARENA_EMAIL_COOKIE_NAME } from '@/lib/arena-email-constants';
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
    const body = (await request.json().catch(() => null)) as {
      query?: unknown;
      conversationId?: unknown;
    } | null;
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

    // The client generates ONE stable conversation id per search session and
    // reuses it for every enrich call — the workflow keys its stored
    // candidates on this value. Accept the client's id when provided;
    // otherwise mint a fresh one and return it so the client can reuse it.
    const clientCid =
      typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';
    const conversationId =
      clientCid && clientCid.length <= 128 ? clientCid : randomUUID();

    // Session email from the Arena cookie (set by middleware) — included in
    // the workflow request so history rows are keyed to this user.
    const emailId = request.cookies.get(ARENA_EMAIL_COOKIE_NAME)?.value?.trim() ?? '';

    const { url, key } = getProspectLensConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_ABORT_MS);
    const started = Date.now();

    try {
      // Workflow contract: the Start trigger expects a FLAT object with
      // `input` and `conversationId` — NOT wrapped in an `inputs` object.
      // The session email rides along as `email` when present. Auth via
      // x-api-key.
      const workflowPayload: Record<string, string> = { input: query, conversationId };
      if (emailId) workflowPayload.email = emailId;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        body: JSON.stringify(workflowPayload),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await res.text();
      console.log('PL identify timing', { ms: Date.now() - started, status: res.status });
      console.log('PL identify payload', res.status, raw.slice(0, 1500));

      const data = parseJsonLoose(raw) ?? {};
      // The execute API nests the workflow result under `output` — never read
      // candidates/message at the top level: const out = data.output ?? data.
      const out = unwrapOutput(data);
      // Assistant prose: out.message ?? out.row?.data?.message.
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

      // Candidates come back either as out.candidates (array) OR as a JSON
      // string at out.row.data.candidates_json — extractCandidates handles both.
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
