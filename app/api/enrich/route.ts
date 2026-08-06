import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getProspectLensConfig,
  parseJsonLoose,
  readMessage,
  toEnrichedPeople,
  unwrapOutput,
} from '@/lib/prospect-lens-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UPSTREAM_ABORT_MS = 295_000;

/**
 * Enrichment is driven purely by card selection. The client sends the picked
 * card numbers as a BARE selection string — just numbers, e.g. "1" or "1, 3"
 * (no sentence) — plus the SAME conversationId returned by /api/identify.
 * The Selection Gate needs the bare pick as `input` — there is NO selectedId
 * field in the contract. The Start trigger expects a FLAT body:
 * { input: String(selection), conversationId } (no `inputs` wrapper).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      selection?: unknown;
      conversationId?: unknown;
    } | null;

    const selection =
      typeof body?.selection === 'string'
        ? body.selection.trim()
        : typeof body?.selection === 'number'
          ? String(body.selection)
          : '';
    const conversationId =
      typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';

    if (!selection || !conversationId) {
      return NextResponse.json(
        {
          results: [],
          contacts: [],
          message: 'Select at least one contact and run a search first (missing selection or conversationId).',
        },
        { status: 400 },
      );
    }

    // The picked card numbers, exactly as displayed — just the bare string.
    const input = String(selection);

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
        // FLAT Start-trigger contract: bare pick as `input`, no selectedId,
        // no `inputs` wrapper.
        body: JSON.stringify({ input, conversationId }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await res.text();
      console.log('PL enrich timing', { ms: Date.now() - started, status: res.status });
      console.log('PL enrich payload', res.status, raw.slice(0, 1500));

      const data = parseJsonLoose(raw) ?? {};
      // Always read the workflow result under `output`: const out = data.output ?? data.
      const out = unwrapOutput(data);
      // Assistant prose: out.message ?? out.row?.data?.message.
      const message = readMessage(out);

      if (!res.ok) {
        return NextResponse.json(
          {
            results: [],
            contacts: [],
            message:
              message ||
              `The enrichment service returned HTTP ${res.status}. ${raw.slice(0, 300)}`,
          },
          { status: 502 },
        );
      }

      // Enriched people live in out.selected_details_json (array), with
      // fallbacks to out.candidates and JSON.parse(out.row?.data?.candidates_json)
      // — each entry carrying work_email.
      const results = toEnrichedPeople(out);

      if (results.length === 0 && !message) {
        return NextResponse.json(
          {
            results: [],
            contacts: [],
            message: `Enrichment completed (HTTP ${res.status}) but returned no details. Raw: ${raw.slice(0, 300)}`,
          },
          { status: 502 },
        );
      }

      // `contacts` mirrors `results` so clients can read either key per the
      // console contract ({ contacts, message }).
      return NextResponse.json({ results, contacts: results, message });
    } catch (err) {
      const aborted = controller.signal.aborted;
      console.error('PL enrich fetch failed', {
        ms: Date.now() - started,
        abortedByUs: aborted,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        {
          results: [],
          contacts: [],
          message: aborted
            ? 'The enrichment ran longer than the 295-second budget and was stopped. Please try again.'
            : 'I could not reach the enrichment service (network error). Please try again in a moment.',
        },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json(
      { results: [], contacts: [], message: 'Enrichment failed unexpectedly. Please try again.' },
      { status: 500 },
    );
  }
}
