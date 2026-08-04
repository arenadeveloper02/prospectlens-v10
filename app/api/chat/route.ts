import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getWorkflowConfig,
  looksLikeInternalPayload,
  parseWorkflowResponse,
  redactPhones,
  SELECTED_OUTPUTS,
} from '@/lib/prospectlens';
import { ARENA_EMAIL_COOKIE_NAME } from '@/lib/arena-email-constants';

export const dynamic = 'force-dynamic';
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
    const timeout = setTimeout(() => controller.abort(), 180_000);

    let reply: string | null = null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key,
        },
        body: JSON.stringify({
          input: message,
          message,
          conversationId,
          conversation_id: conversationId,
          stream: true,
          selectedOutputs: SELECTED_OUTPUTS,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await response.text();

      if (response.ok) {
        reply = parseWorkflowResponse(raw);
      }
    } catch {
      // network failure or timeout — fall through to friendly message
    } finally {
      clearTimeout(timeout);
    }

    // Defense in depth: even after whitelist extraction, never let anything
    // that still looks like raw JSON or internal workflow state (candidates
    // payloads, conversation ids, enrich status, selection state) reach the
    // user. Treat it exactly like a missing reply and show the friendly copy.
    const candidate = reply && reply.trim() ? reply.trim() : null;
    const safeReply = redactPhones(
      candidate && !looksLikeInternalPayload(candidate) ? candidate : FRIENDLY_FAILURE,
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
