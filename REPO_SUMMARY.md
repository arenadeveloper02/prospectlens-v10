# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T11:57:27.550Z.

## Overview

Prospect Lens Console — conversational console for finding, selecting, and enriching professional contacts.

**Repository:** `prospectlens-v10`  
**File count:** 34

## Features

- 60s function budget with ~58s upstream abort so long multi-lookup searches complete instead of timing out
- Agent-block-aware response parsing: prefers Format Export → Apollo Contact Finder → Present Cards content and never surfaces trailing table statuses like 'Row updated successfully'
- Stable per-browser-session conversationId reused for every turn (search → pick → enrich → export)
- Markdown rendering with candidate cards, tables, and CSV export blocks
- Debuggable errors: real upstream HTTP status surfaced in chat and raw payload logged in Vercel

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

- **Updated at:** 2026-08-05T11:57:27.550Z
- **Request:** Fix Prospect Lens v10 frontend: (A) timeouts on search, (B) it sometimes shows the raw "Row updated successfully" status instead of the real answer. Do NOT change the workflow.

Context: The Arena workflow ends at one of three agent blocks whose text is the user-facing answer — Present Cards (search), Apollo Contact Finder (selection/enrich), Format Export (export). Each exposes its text under content. After those agents, table blocks run and return status strings like "Row updated successfully". The frontend must surface the AGENT content, never the trailing table status. Also, a real search legitimately takes 30–60s, which is causing "I couldn't complete that search just now" timeouts.

Env vars (Vercel → Settings → Environment Variables; never hard-code):

PUREMUON_URL = https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PUREMUON_API_KEY = <PUREMUON_API_KEY>
Tasks

Fix the timeout (primary). Add export const maxDuration = 60; (or higher if your Vercel plan allows) to every app/api/**/route.ts, set maxDuration: 60 in vercel.json, and give the outbound fetch an AbortController of ~58s. Searches run a long chain of live lookups; short function limits are the main cause of the "couldn't complete" error.
Read the AGENT output, not the last block. The execute response includes per-block outputs. Prefer the named agent blocks in this priority order and use the FIRST that has non-empty text; explicitly IGNORE table/status strings like "Row updated successfully" / "Rows inserted":
ts

const json = await res.json().catch(() => null);
const IGNORE = /^(row|rows)\b.*\b(updated|inserted|upserted|added|saved)\b/i;

// block outputs may live under json.blocks / json.output.blocks / json.logs — adjust to actual shape
const byName = (name: string): string | undefined => {
const b = json?.blocks?.[name] ?? json?.output?.[name];
const c = b?.content ?? b?.output?.content;
return typeof c === "string" && c.trim() ? c : undefined;
};

let message =
byName("Format Export") ??
byName("Apollo Contact Finder") ??
byName("Present Cards") ??
// generic fallbacks:
json?.output?.content ?? json?.content ??
(typeof json?.output === "string" ? json.output : undefined);

if (typeof message === "string" && IGNORE.test(message.trim())) message = undefined;

if (!res.ok || !message) {
console.error("PL upstream", res.status, JSON.stringify(json)?.slice(0, 1500));
return NextResponse.json({ error: "upstream_unreadable", status: res.status }, { status: 502 });
}
return NextResponse.json({ message });
Adjust json?.blocks?.[name] to the execute API's real shape — see task 3.

Log the raw upstream JSON (first ~1500 chars) once so you can confirm exactly where per-block content lives, then tighten the selectors above to the real path.
Keep the request body EXACTLY { "input": "<user msg>", "conversationId": "<stable-per-session-id>" } with the key in the x-api-key header. Generate conversationId ONCE per browser session and reuse it for every turn (search → pick a number → enrich → "show all my contacts"). Do NOT rename it (conversation_id/sessionId) or derive it from an email that can be blank/shared — the workflow stores and reloads candidates keyed on this exact value, so an unstable id breaks number-picking and export even when search works.
Render message as Markdown (the export turn returns a Markdown table + a fenced CSV block). On a 502/error, surface the real status instead of the generic fallback.
Commit, push, redeploy (env changes require a redeploy).
Acceptance test (replace placeholder locally; the first call may take up to ~60s — that's expected):

bash

curl -s --max-time 75 -X POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute \
 -H "Content-Type: application/json" -H "x-api-key: <PUREMUON_API_KEY>" \
 -d '{"input":"Find the CMO of Vercel","conversationId":"test-123"}' | head -c 1500
Then, SAME conversationId: {"input":"1",...} must return an enriched contact card (NOT "Row updated successfully"), and {"input":"show all my contacts",...} must return the table.
