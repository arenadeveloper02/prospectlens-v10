# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T11:39:16.558Z.

## Overview

Prospect Lens Console — conversational console for finding, selecting, and enriching professional contacts via the Arena workflow.

**Repository:** `prospectlens-v10`  
**File count:** 34

## Features

- Chat console with Markdown rendering (tables, candidate cards, CSV export blocks)
- Robust multi-branch workflow response parsing including structured { mode, candidates, message } payloads
- 60s function budget with 55s outbound abort so real 20–50s searches never die to Vercel timeouts
- Stable per-browser-session conversationId reused across search → pick → enrich → export
- Debuggable upstream failures: raw payload logged (first 1500 chars) and real status surfaced in the UI
- Arena email gate with access-denied page and cross-origin iframe support

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

- **Updated at:** 2026-08-05T11:39:16.558Z
- **Request:** Fix Prospect Lens v10 frontend: response parsing + function timeout. Do NOT change the workflow.

Context: The Arena workflow ends at one of several blocks depending on the turn. The final visible text lives under the terminal block's content, but the search branch also carries a structured object { mode, selected_ids, candidates, message }. The app currently (a) times out on real searches and (b) can't locate the text when the payload is an object, so it shows "responded (HTTP 200) but I could not find a readable message" or "I couldn't complete that search just now."

Env vars (Vercel → Settings → Environment Variables; never hard-code):

PUREMUON_URL = https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PUREMUON_API_KEY = <PUREMUON_API_KEY>
Tasks

Timeout (do this first — it's the main cause of the "couldn't complete" errors). In every app/api/**/route.ts add export const maxDuration = 60; and set maxDuration: 60 in vercel.json. Give the outbound fetch an AbortController timeout of ~55s. A real search runs multiple upstream lookups and legitimately takes 20–50s.
Parse the payload robustly. The agent text can arrive as a string OR inside a structured object. After await fetch(...):
ts

const json = await res.json().catch(() => null);

const pickString = (o: any): string | undefined => {
if (o == null) return undefined;
if (typeof o === "string") return o;
// common wrappers
const cands = [o.output, o.data?.output, o.result, o.data];
for (const c of cands) {
if (typeof c === "string") return c;
if (c && typeof c.content === "string") return c.content;
if (c && typeof c.message === "string") return c.message;
}
if (typeof o.content === "string") return o.content;
// structured search-turn object: { mode, candidates, message }
if (typeof o.message === "string") return o.message;
const deepMsg = o.output?.message ?? o.data?.output?.message;
if (typeof deepMsg === "string") return deepMsg;
return undefined;
};

const message = pickString(json);
if (!res.ok || message == null) {
console.error("PL upstream", res.status, JSON.stringify(json)?.slice(0, 1500));
return NextResponse.json({ error: "upstream_unreadable", status: res.status }, { status: 502 });
}
return NextResponse.json({ message });
Log the raw upstream JSON (first ~1500 chars) on any failure so the exact wrapper key is visible in Vercel logs.
Request body stays exactly { "input": "<user msg>", "conversationId": "<stable-per-session-id>" } with the key in the x-api-key header. Generate conversationId once per browser session and reuse it across search → pick a number → enrich → export. Do NOT rename it (conversation_id/sessionId) or derive it from an email that can be blank/shared — the workflow keys saved candidates on it, so an unstable value silently breaks number-picking and export.
Render the returned message as Markdown (export returns a Markdown table + fenced CSV). On 502/error, show the real status, not the generic fallback.
Commit, push, redeploy (env changes require a redeploy).
Acceptance test (replace placeholder locally; confirm it returns text, not a timeout):

bash

curl -s --max-time 70 -X POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute \
 -H "Content-Type: application/json" -H "x-api-key: <PUREMUON_API_KEY>" \
 -d '{"input":"Find the CMO of Vercel","conversationId":"test-123"}' | head -c 1500
Then, same conversationId: {"input":"1",...} should enrich, {"input":"show all my contacts",...} should return the table.
