# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T11:26:58.023Z.

## Overview

Prospect Lens Console — conversational console for finding, selecting, and enriching professional contacts via the Arena workflow.

**Repository:** `prospectlens-v10`  
**File count:** 34

## Features

- Defensive multi-branch workflow response parsing (output.content, data.output.content, output, content, result.content, data.content, reply)
- Raw upstream payload logging (first 1000 chars) on any failure for Vercel log debugging
- maxDuration 60 on every API route plus vercel.json function budget
- Exact camelCase { input, conversationId } request contract with x-api-key header and stable per-browser-session conversationId
- Debuggable 502 upstream errors surfaced in the chat instead of a generic fallback
- Markdown rendering of card, enrich, and export (table + fenced CSV) turns

## Tech Stack

- Next.js ^15.3.3 (App Router)
- React ^19.0.0
- Tailwind CSS v3
- TypeScript
- Prisma + PostgreSQL (Neon on Vercel)

## Infrastructure

- **DATABASE_URL:** set on Vercel when Neon is connected — do not commit real credentials

## Routes & Pages

- `/` — `app/page.tsx`
- `/access-denied` — `app/access-denied/page.tsx`

## Database Models

- `ChatMessage`

## File Inventory

### App pages

- `app/access-denied/page.tsx`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`

### API routes

- `app/api/chat/route.ts`
- `app/api/health/route.ts`

### Components

- `components/ChatClient.tsx`
- `components/Markdown.tsx`
- `components/ParticleField.tsx`
- `components/QuickChips.tsx`
- `components/TypingIndicator.tsx`
- `components/arena-email-provider.tsx`

### Libraries

- `lib/arena-email-constants.ts`
- `lib/arena-email.ts`
- `lib/prisma.ts`
- `lib/prospectlens.ts`
- `lib/types.ts`
- `prisma/schema.prisma`

### Config

- `.env.example`
- `middleware.ts`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `tsconfig.json`
- `vercel.json`

### Other

- `CHANGES.md`
- `README.md`
- `REPO_SUMMARY.md`

## Complete File Index

- `.env.example`
- `CHANGES.md`
- `README.md`
- `REPO_SUMMARY.md`
- `app/access-denied/page.tsx`
- `app/api/chat/route.ts`
- `app/api/health/route.ts`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`
- `components/ChatClient.tsx`
- `components/Markdown.tsx`
- `components/ParticleField.tsx`
- `components/QuickChips.tsx`
- `components/TypingIndicator.tsx`
- `components/arena-email-provider.tsx`
- `lib/arena-email-constants.ts`
- `lib/arena-email.ts`
- `lib/prisma.ts`
- `lib/prospectlens.ts`
- `lib/types.ts`
- `middleware.ts`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `postcss.config.mjs`
- `prisma/schema.prisma`
- `tailwind.config.ts`
- `tsconfig.json`
- `vercel.json`

## Latest Change

- **Updated at:** 2026-08-05T11:26:58.023Z
- **Request:** Fix Prospect Lens v10 so it reliably reads and renders the workflow response.

Background (do not change the workflow — only the frontend): The Arena workflow is multi-branch. Depending on the turn it ends at one of three agents, each returning its text in a content field: Present Cards (search), Apollo Contact Finder (selection/enrich), or Format Export (export). The execute API wraps that. The current app assumes one fixed response path, so on some turns it shows "The search service responded, but I could not read a usable answer from it." Other turns show "I couldn't complete that search just now" — a function timeout.

Environment variables (set in Vercel → Settings → Environment Variables; never hard-code):

PUREMUON_URL = https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PUREMUON_API_KEY = <PUREMUON_API_KEY> (paste the real workspace key in Vercel only)
Tasks:

In every app/api/**/route.ts, after await fetch(PUREMUON_URL, ...), parse the response defensively — the agent text can arrive under any of these, so return the first that exists:
const json = await res.json().catch(() => null);
const pick = (o: any): string | undefined =>
o?.output?.content ??
o?.data?.output?.content ??
(typeof o?.output === "string" ? o.output : undefined) ??
o?.content ??
o?.result?.content ??
o?.data?.content ??
(typeof o === "string" ? o : undefined);
const message = pick(json);
if (!res.ok || message == null) {
console.error("PL upstream", res.status, JSON.stringify(json)?.slice(0, 1000));
return NextResponse.json({ error: "upstream_unreadable", status: res.status }, { status: 502 });
}
return NextResponse.json({ message });


Log the raw upstream JSON (first ~1000 chars) on any failure so the exact key is visible in Vercel logs — remove the guesswork about which branch ran.
Set export const maxDuration = 60; on every API route (and maxDuration: 60 in vercel.json). A real search takes 20–50s; the "couldn't complete" message is a Vercel function timeout.
Send the request body EXACTLY as (camelCase keys, unchanged):

{ "input": "<user message>", "conversationId": "<stable-per-session-id>" }


with the key in the x-api-key header. Generate conversationId once per browser session and reuse it across every turn (search → pick a number → enrich → export). Do NOT rename it (conversation_id, sessionId) and do NOT derive it from the user's email in a way that can be blank or shared — the workflow keys saved candidates on it, so an unstable value silently breaks number-picking and export even though searches still return.

Render the returned message string as Markdown (the export turn returns a Markdown table + a fenced CSV block; the card turns return formatted text). On a 502/error, surface the real status instead of the generic fallback so failures are debuggable.
Commit, push, redeploy (env-var changes require a redeploy).
Acceptance test (replace the placeholder with the real key locally; confirm which key holds the text and that pick() returns it):

curl -s -X POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute \
 -H "Content-Type: application/json" \
 -H "x-api-key: <PUREMUON_API_KEY>" \
 -d '{"input":"Find the CMO of Vercel","conversationId":"test-123"}' | head -c 1200


Then, in the SAME conversationId, {"input":"1","conversationId":"test-123"} should enrich, and {"input":"show all my contacts","conversationId":"test-123"} should return the table.
