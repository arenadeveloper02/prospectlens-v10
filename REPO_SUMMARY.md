# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T12:12:28.396Z.

## Overview

Prospect Lens Console — conversational console for finding, selecting, and enriching professional contacts, with structured candidate cards, upstream timing diagnostics, and a 60s function budget for slow searches.

**Repository:** `prospectlens-v10`  
**File count:** 35

## Features

- Chat console backed by the Prospect Lens workflow (body kept EXACTLY { input, conversationId } with x-api-key header)
- Structured candidate cards parsed from the workflow's candidates[] array — clickable numbered cards trigger enrichment
- Upstream timing + status logging to distinguish our AbortController, platform timeouts, and workflow errors in Vercel logs
- maxDuration 60 on every API route plus vercel.json function config; outbound fetch aborts at ~58s
- Stable per-browser-session conversationId cookie reused across every turn
- Quick-pick number buttons and quick-phrase chips
- Markdown rendering with tables, candidate cards, and CSV export blocks
- Arena email gate with access-denied page

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

- `components/CandidateCards.tsx`
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
- `components/CandidateCards.tsx`
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

- **Updated at:** 2026-08-05T12:12:28.396Z
- **Request:** Prospect Lens v10 — searches intermittently time out ("didn't fully complete") and candidate cards don't render. Parsing is already fixed (Stripe search shows the correct message). Do NOT change the workflow.

Env vars (Vercel → Settings → Environment Variables; never hard-code):

PUREMUON_URL = https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PUREMUON_API_KEY = <PUREMUON_API_KEY>
Tasks

Confirm the Vercel plan and raise the function limit. On Hobby, functions hard-cap at 10s and maxDuration is ignored — that alone explains why slower searches (Vercel CMO, Notion VP Sales) fail while fast ones (Stripe) succeed. Ensure the project is on a plan that allows ≥60s, then set export const maxDuration = 60; in every app/api/**/route.ts AND maxDuration: 60 in vercel.json. Give the outbound fetch an AbortController of ~58s. If 60s still isn't enough for the deepest searches, either move the call to a background/streaming pattern or raise the plan's max duration.
Verify the timeout is upstream, not our fetch. Add a duration log around the fetch (console.time/Date.now() delta) and log res.status. Confirm in Vercel logs whether failing turns are (a) hitting our AbortController, (b) hitting Vercel's platform limit, or (c) the workflow itself erroring — then fix accordingly.
Render the candidate CARDS, not just the lead-in sentence. The search response includes both a short message AND a structured candidates array (fields include name, title, company, linkedin, and a numeric index). Today only the lead-in sentence shows. Map each candidates[] item to a numbered card UI so users can click 1/2/3. Locate the array by logging the raw upstream JSON (first ~1500 chars) and reading candidates from wherever the object sits (e.g. output.candidates or a JSON string in the agent content that must be JSON.parsed).
Keep the request body EXACTLY { "input": "<user msg>", "conversationId": "<stable-per-session-id>" } with the key in x-api-key. Generate conversationId once per browser session and reuse it across every turn; the workflow stores candidates keyed on it, so number-picking/export break if it changes.
Commit, push, redeploy.
Acceptance test (the slow searches are the ones that must pass; allow up to ~60s):

bash

curl -s --max-time 75 -w "\n[%{time_total}s]\n" -X POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute \
 -H "Content-Type: application/json" -H "x-api-key: <PUREMUON_API_KEY>" \
 -d '{"input":"Find the CMO of Vercel","conversationId":"test-123"}' | head -c 1500
If [time_total] prints ~30–55s and returns candidates, the fix is a plan/maxDuration change — not code.
