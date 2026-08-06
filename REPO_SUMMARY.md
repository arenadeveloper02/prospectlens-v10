# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-06T09:03:09.768Z.

## Overview

A conversational Prospect Lens console for finding, selecting, and enriching professional contacts via the Arena workflow, with a stable per-search conversation id reused across identify and enrich calls.

**Repository:** `prospectlens-v10`  
**File count:** 41

## Features

- Identify leadership contacts via the Prospect Lens workflow with a flat { input, conversationId } contract
- One stable crypto.randomUUID conversation id generated per search and reused verbatim for enrich
- Selection-driven batch enrichment reading selected_details_json[].work_email with personal_email fallback
- status: 'enriched' treated as the success flag when merging results onto the same cards
- CSV export of identified and enriched contacts
- Best-effort chat message logging to Neon Postgres via Prisma
- Arena email gate with access-denied page and cross-origin iframe headers

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
- `app/api/enrich/route.ts`
- `app/api/health/route.ts`
- `app/api/identify/route.ts`

### Components

- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
- `components/Markdown.tsx`
- `components/ParticleField.tsx`
- `components/ProspectConsoleClient.tsx`
- `components/QuickChips.tsx`
- `components/TypingIndicator.tsx`
- `components/arena-email-provider.tsx`

### Libraries

- `lib/arena-email-constants.ts`
- `lib/arena-email.ts`
- `lib/enrich-extract.ts`
- `lib/prisma.ts`
- `lib/prospect-lens-api.ts`
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

- `.env.local.example`
- `CHANGES.md`
- `README.md`
- `REPO_SUMMARY.md`

## Complete File Index

- `.env.example`
- `.env.local.example`
- `CHANGES.md`
- `README.md`
- `REPO_SUMMARY.md`
- `app/access-denied/page.tsx`
- `app/api/chat/route.ts`
- `app/api/enrich/route.ts`
- `app/api/health/route.ts`
- `app/api/identify/route.ts`
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
- `components/ProspectConsoleClient.tsx`
- `components/QuickChips.tsx`
- `components/TypingIndicator.tsx`
- `components/arena-email-provider.tsx`
- `lib/arena-email-constants.ts`
- `lib/arena-email.ts`
- `lib/enrich-extract.ts`
- `lib/prisma.ts`
- `lib/prospect-lens-api.ts`
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

- **Updated at:** 2026-08-06T09:03:09.768Z
- **Request:** PROMPT — Wire Leadership Finder enrich round-trip to Prospect Lens

The Prospect Lens workflow saves identified candidates under the conversation id. Enrich reloads them by that same id. So the client MUST generate a conversation id on search and reuse it on enrich.

.env.example and .env.local.example:
code

PROSPECT_LENS_URL=https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PROSPECT_LENS_API_KEY=sk-sim-FKxMxim0lRkjj3Ssw3oh4lAGF9Ewaz25
Set the same two in Vercel → Settings → Env Vars (Production + Preview), then redeploy.

app/page.tsx — generate ONE stable conversation id per search session and reuse it for the enrich call:
ts

// on a NEW search:
const conversationId = crypto.randomUUID();
// store it in state; pass the SAME value to both /api/identify and /api/enrich
app/api/identify/route.ts — send flat input + conversationId:
ts

body: JSON.stringify({ input: query, conversationId }),
app/api/enrich/route.ts — send the bare pick as input (e.g. "1" or "1, 3") and the SAME conversationId from the search; drop the unused selectedId:
ts

body: JSON.stringify({ input: String(contactId), conversationId }),
The enrich card should read the email from the workflow's selected_details_json[].work_email (falling back to personal_email), and treat status: "enriched" as the success flag.

Keep all card styling/layout unchanged — the design is correct.
