import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  describeWorkflowError,
  getWorkflowConfig,
  looksLikeInternalPayload,
  parseWorkflowResponse,
  redactPhones,
} from '@/lib/prospectlens';
import { ARENA_EMAIL_COOKIE_NAME } from '@/lib/arena-email-constants';

export const dynamic = 'force-dynamic';
// A real search runs multiple upstream lookups and legitimately takes
// 20–50s. Give the function a 60s budget (also pinned in vercel.json) so the
// workflow run never dies to a Vercel function timeout.
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

const FRIENDLY_FAILURE =
  "I couldn't complete that search just now. Please try again in a moment — your conversation is safe and nothing was lost.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      message?: unknown;
      conversationId?: unknown;
    } | null;

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const conversationId =
      typeof body?.conversationId === 'string' && body.conversationId.trim()
        ? body.conversationId.trim()
        : '';

    if (!message || !conversationId) {
      return NextResponse.json(
        { reply: 'Please type a message so I can start searching.' },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { reply: 'That message is a little long — could you shorten it and try again?' },
        { status: 400 },
      );
    }

    if (isRateLimited(conversationId)) {
      return NextResponse.json(
        {
          reply:
            "You're sending messages a little quickly — give me a few seconds to catch up, then try again.",
        },
        { status: 429 },
      );
    }

    const emailId = request.cookies.get(ARENA_EMAIL_COOKIE_NAME)?.value ?? null;

    try {
      await prisma.chatMessage.create({
        data: { conversationId, emailId, role: 'user', content: message },
      });
    } catch {
      // logging is best-effort; never block the chat
    }

    const { url, key } = getWorkflowConfig();
    const controller = new AbortController();
    // Abort just under the 60s function budget so we always return our own
    // JSON response instead of hitting a hard Vercel timeout.
    const timeout = setTimeout(() => controller.abort(), 55_000);

    let reply: string | null = null;
    let errorNotice: string | null = null;
    let upstreamError: string | null = null;
    let upstreamStatus = 0;
    try {
      // Workflow contract — send the body EXACTLY as camelCase
      // { input, conversationId } with the key in the x-api-key header.
      // conversationId is stable per browser session; the workflow keys saved
      // candidates on it, so it must never be renamed or regenerated per turn.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ input: message, conversationId }),
        signal: controller.signal,
        cache: 'no-store',
      });

      upstreamStatus = response.status;
      const raw = await response.text();

      if (response.ok) {
        // Multi-branch parse: Present Cards / Apollo Contact Finder /
        // Format Export each return text under a different key — and the
        // search branch may carry a structured object
        // { mode, selected_ids, candidates, message } whose visible text is
        // under `message`. parseWorkflowResponse tries output.content,
        // data.output.content, output.message, output, content, message,
        // result.content, result.message, data.content, data.message, reply,
        // SSE chunks, and finally a recursive scan.
        reply = parseWorkflowResponse(raw);
        if (!reply) {
          // Log the raw upstream JSON so the exact wrapper key is visible in
          // Vercel logs (first ~1500 chars).
          console.error('PL upstream unreadable', upstreamStatus, raw.slice(0, 1500));
          upstreamError = 'upstream_unreadable';
          errorNotice = `The search service responded (HTTP ${upstreamStatus}), but I could not find a readable message in its payload. Please try again in a moment.`;
        }
      } else {
        console.error('PL upstream error', upstreamStatus, raw.slice(0, 1500));
        upstreamError = 'upstream_error';
        errorNotice = describeWorkflowError(upstreamStatus, raw);
      }
    } catch (err) {
      console.error('PL upstream fetch failed', err instanceof Error ? err.message : String(err));
      upstreamError = 'upstream_unreachable';
      errorNotice =
        'I could not reach the search service (network error or the request timed out). Please try again in a moment.';
    } finally {
      clearTimeout(timeout);
    }

    // Defense in depth: never let anything that still looks like raw JSON or
    // internal workflow state reach the user.
    const candidate = reply && reply.trim() ? reply.trim() : null;
    const usable = candidate && !looksLikeInternalPayload(candidate) ? candidate : null;
    if (candidate && !usable && !upstreamError) {
      console.error('PL upstream internal-state reply', upstreamStatus, candidate.slice(0, 1500));
      upstreamError = 'upstream_unreadable';
      errorNotice = `The search service responded (HTTP ${upstreamStatus || 200}), but the payload contained internal state rather than a message. Please try again in a moment.`;
    }

    const safeReply = redactPhones(usable ?? errorNotice ?? FRIENDLY_FAILURE);

    try {
      await prisma.chatMessage.create({
        data: { conversationId, emailId, role: 'assistant', content: safeReply },
      });
    } catch {
      // logging is best-effort; never block the chat
    }

    if (!usable && upstreamError) {
      // Surface the real upstream status so failures are debuggable in the UI
      // and in Vercel logs instead of hiding behind generic fallback copy.
      return NextResponse.json(
        { reply: safeReply, error: upstreamError, status: upstreamStatus },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: safeReply });
  } catch {
    return NextResponse.json({ reply: FRIENDLY_FAILURE }, { status: 500 });
  }
}
