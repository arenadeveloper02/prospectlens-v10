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
// Real searches can take 20–50s; keep this well above 60s so runs never time out.
export const maxDuration = 300;

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
    // Workflow contract: allow up to 120s for the run to complete.
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let reply: string | null = null;
    let errorNotice: string | null = null;
    try {
      // Workflow contract: POST { input, conversationId } (exact camelCase keys)
      // with BOTH x-api-key and Authorization: Bearer headers. The JSON body's
      // result is { reply, mode, cardCount } (possibly under data.result /
      // data.output / data.content).
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

      const raw = await response.text();

      if (response.ok) {
        reply = parseWorkflowResponse(raw);
        if (!reply) {
          errorNotice =
            'The search service responded, but I could not read a usable answer from it. Please try again in a moment.';
        }
      } else {
        // Surface the actual error (status + detail) so failures are debuggable
        // instead of hiding everything behind the generic fallback copy.
        errorNotice = describeWorkflowError(response.status, raw);
      }
    } catch {
      errorNotice =
        'I could not reach the search service (network error or the request timed out). Please try again in a moment.';
    } finally {
      clearTimeout(timeout);
    }

    // Defense in depth: even after extraction, never let anything that still
    // looks like raw JSON or internal workflow state (candidates payloads,
    // conversation ids, enrich status, selection state) reach the user.
    const candidate = reply && reply.trim() ? reply.trim() : null;
    const safeReply = redactPhones(
      candidate && !looksLikeInternalPayload(candidate)
        ? candidate
        : errorNotice ?? FRIENDLY_FAILURE,
    );

    try {
      await prisma.chatMessage.create({
        data: { conversationId, emailId, role: 'assistant', content: safeReply },
      });
    } catch {
      // logging is best-effort; never block the chat
    }

    return NextResponse.json({ reply: safeReply });
  } catch {
    return NextResponse.json({ reply: FRIENDLY_FAILURE }, { status: 500 });
  }
}
