# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T16:59:53.189Z.

## Overview

Prospect Lens Console — a conversational console for finding, selecting, and enriching professional contacts via the deployed Prospect Lens workflow.

**Repository:** `prospectlens-v10`  
**File count:** 41

## Features

- Identify contacts via the Prospect Lens workflow ({ inputs: { input, conversationId } } + x-api-key)
- Reads workflow results under output, including row.data.candidates_json JSON-string fallback
- Selection-driven batch enrichment sending a bare selection string (e.g. "1, 3") with the same conversationId
- Verified work emails merged back onto the same contact cards
- CSV export of identified and enriched contacts
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

- **Updated at:** 2026-08-05T16:59:53.189Z
- **Request:** Fix the Leadership Finder app's connection to the deployed Prospect Lens workflow. The workflow is verified working; the app calls it wrong. Apply all:

1. .env.example and .env.local.example:

code

PROSPECT_LENS_URL=https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PROSPECT_LENS_API_KEY=sk-sim-WdwOSPQf0WHp5JiHs1jIGgj-kJ4ypP3q
Set the same two in Vercel (Production + Preview) and redeploy.

2. Contract: every call sends { "inputs": { "input": "<string>", "conversationId": "<string>" } } with header x-api-key. The response nests results under output. Read const out = data.output ?? data. Candidates come back either as out.candidates (array) OR as a JSON string at out.row.data.candidates_json — parse that string when present. Assistant prose is out.message ?? out.row?.data?.message.

3. identify/route.ts: change body to JSON.stringify({ inputs: { input: query, conversationId } }). Build const out = data.output ?? data, then get candidates from out.candidates or JSON.parse(out.row?.data?.candidates_json || '[]'), map with existing toContact. Return { conversationId, contacts, message: out.message ?? out.row?.data?.message ?? '' }.

4. enrich/route.ts: the input MUST be a bare selection string — just numbers, e.g. "1" or "1, 3" (no sentence). Remove selectedId entirely. Body: JSON.stringify({ inputs: { input: String(selection), conversationId } }). Read out = data.output ?? data; the enriched people are in out.selected_details_json (array) or JSON.parse(out.row?.data?.candidates_json||'[]') — take work_email per person. Return { contacts, message }.

5. page.tsx: persist conversationId from the identify response in state and send the SAME one on enrich. Selecting cards = collect the picked cards' 1-based numbers, join with ", ", send as selection. On identify response read data.contacts/data.conversationId/data.message (remove reads of data.company/data.reply/data.counts that don't exist). Merge enrich data.contacts back by matching id/name and set work_email.

6. Keep styling untouched; surface the real detail on errors. Confirm build passes.
