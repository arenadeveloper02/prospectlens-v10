# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T16:18:39.076Z.

## Overview

Prospect Lens Console — a conversational console for finding, selecting, and enriching professional contacts via the Arena Prospect Lens workflow.

**Repository:** `prospectlens-v10`  
**File count:** 40

## Features

- Identify contacts via POST /api/identify using the { inputs: { input, conversationId } } workflow contract
- Selection-driven enrichment: picked card numbers are joined and sent as the workflow input via POST /api/enrich
- Stable conversationId persisted in client state between identify and enrich calls
- Reads workflow results from data.output ?? data (out.candidates / out.selected_details_json / out.message)
- Debuggable error surfacing with real upstream HTTP status and message
- CSV export of identified and enriched contacts

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

- **Updated at:** 2026-08-05T16:18:39.076Z
- **Request:** Fix the Prospect Lens integration in this Next.js app (leadership-finder-app). The app currently fails with "The search didn't complete" because the API routes call the wrong host, send the wrong payload shape, and read the response at the wrong level. Apply all of the following exactly.

1. Environment variables — update both app/api/.env.example-style files: files/leadership-finder-app/.env.example and files/leadership-finder-app/.env.local.example. Set these two keys (replace any sim.ai URL and any placeholder key):

code

PROSPECT_LENS_URL=https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
PROSPECT_LENS_API_KEY=sk-arena-3f9c2a7e5b1d48609a2f6c8e4d0b7a12
Also set these same two variables in Vercel → Project → Settings → Environment Variables (Production + Preview).

2. The workflow contract (source of truth). The deployed Prospect Lens workflow's Start block accepts ONLY two inputs: input (string) and conversationId (string). The execute API requires them wrapped in an inputs object, and returns the workflow result nested under output. There is NO selectedId field — remove any use of it.

Request body for every call MUST be:

json

{ "inputs": { "input": "<string>", "conversationId": "<string>" } }
Auth header: x-api-key: <PROSPECT_LENS_API_KEY>. Response: read const out = data.output ?? data; then use out.candidates, out.message, out.selected_details_json, etc. — never top-level.

3. app/api/identify/route.ts — for a search query, generate a fresh conversationId (uuid) and return it to the client. Send:

ts

body: JSON.stringify({ inputs: { input: query, conversationId } })
Then:

ts

const data = await res.json().catch(() => ({}));
const out = data.output ?? data;
const contacts = extractCandidates(out).map(toContact);
return NextResponse.json({ conversationId, contacts, message: out.message ?? "" });
4. app/api/enrich/route.ts — enrichment is driven purely by card selection. The client passes the selected card numbers as a string (e.g. "1" or "1, 3") plus the SAME conversationId returned by identify. Delete any selectedId logic. Send:

ts

const input = String(selection); // e.g. "1, 3" — just the picked card numbers
body: JSON.stringify({ inputs: { input, conversationId } })
Then read the enriched people from out.selected_details_json (fallback out.candidates), pulling work_email for each. Return them plus message: out.message ?? "".

5. Frontend (app/page.tsx) — selecting cards IS the input. When the user clicks cards to select them, collect their displayed numbers, join with ", ", and send that string as selection to the enrich route along with the stored conversationId from the identify response. Do not build any other selection mechanism. Persist conversationId in state between the identify call and the enrich call — enrich MUST reuse the exact same conversationId, or the workflow won't find the candidates.

6. Error handling — if a route returns non-2xx or out is empty, surface the actual status/message instead of the generic "try again," so failures are debuggable.

Apply all edits, keep the existing UI/styling untouched (change only data wiring), and confirm the build passes.
