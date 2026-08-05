# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T11:09:25.641Z.

## Overview

Prospect Lens Console — conversational console for finding, selecting, and enriching professional contacts via the Arena workflow.

**Repository:** `prospectlens-v10`  
**File count:** 33

## Features

- Chat console UI with quick phrases and quick-pick candidate selection
- Server-side proxy to the Arena Prospect Lens workflow (correct endpoint + dual auth headers)
- Stable per-session conversationId reused across search → select → enrich → export turns
- Real error surfacing on non-200 workflow responses (HTTP status + detail) instead of generic fallback
- Best-effort chat logging to Postgres via Prisma
- Phone-number redaction and internal-payload leak protection

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

## Latest Change

- **Updated at:** 2026-08-05T11:09:25.641Z
- **Request:** Fix the Prospect Lens v10 frontend so its API calls succeed against the Arena workflow.

Context

The app calls an Arena workflow execute endpoint from its server-side API routes (app/api/**/route.ts).
It currently points at the wrong workflow (pure-muon 166d2c35-…) and/or has a missing/invalid API key, so the UI shows the fallback "I couldn't complete that search just now."
The workflow itself is healthy; only the frontend config is wrong.
Correct configuration

Execute endpoint URL: https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
API key (workspace key): sk-sim-ywX13HywO8xTjvBbPgqjD-Idk2K4gP7P
Tasks

In .env.example and Vercel env vars, ensure these two names exist and are used by the routes:
PUREMUON_URL = the execute URL above (must contain workflow ID 65d2b97b-…, NOT 166d2c35-…)
PUREMUON_API_KEY = the key above
In every app/api/**/route.ts, confirm the request:
Method: POST
Headers: Content-Type: application/json, plus BOTH x-api-key: <PUREMUON_API_KEY> and Authorization: Bearer <PUREMUON_API_KEY>
Body (exact camelCase keys):
{ "input": "<user message>", "conversationId": "<stable per-session id>" }


conversationId must be generated once per browser session and reused across search → select → enrich → export turns (do NOT rename it to conversation_id, sessionId, etc.).
Read the workflow's JSON response and render the returned agent content string in the UI (the message/cards text). Handle non-200 responses by surfacing the actual error instead of the generic fallback, so failures are debuggable.
Set maxDuration to at least 60 for the API route(s) / in vercel.json, since a real search can take 20–50s and must not time out.
Commit, push, and redeploy on Vercel (env var changes require a redeploy).
Acceptance test (should return a Vercel CMO candidate card, not an error):
curl -X POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute \
 -H "Content-Type: application/json" \
 -H "x-api-key: sk-sim-ywX13HywO8xTjvBbPgqjD-Idk2K4gP7P" \
 -d '{"input":"Find the CMO of Vercel","conversationId":"test-123"}'
