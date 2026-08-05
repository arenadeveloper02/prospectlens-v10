# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T12:38:18.011Z.

## Overview

Prospect Lens Console — conversational console for finding, selecting, and enriching professional contacts. This edit raises the serverless function time budget to the Vercel Pro maximum (300s) so deep multi-lookup searches never die to a platform timeout.

**Repository:** `prospectlens-v10`  
**File count:** 35

## Features

- Serverless function maxDuration raised to 300s (Vercel Pro/Enterprise cap) in every app/api/**/route.ts
- vercel.json functions config pinned to maxDuration 300 for all API routes
- Outbound workflow fetch guarded by a ~295s AbortController so it never dangles past the platform limit
- Timing + payload instrumentation preserved for Vercel log debugging
- Chat transcript logging to Postgres via Prisma (best-effort, never blocks the chat)

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

- **Updated at:** 2026-08-05T12:38:18.011Z
- **Request:** Prospect Lens v10 — raise the serverless function time limit to the maximum.

There is no "unlimited" on Vercel; set the highest your plan allows.

Confirm the Vercel plan. Hobby caps at 10s (and ignores maxDuration). Pro/Enterprise allow up to 300s. Upgrade to Pro if on Hobby — otherwise slow searches will always fail.
In every app/api/**/route.ts, add export const maxDuration = 300; (use 60 if on the lower Pro cap).
In vercel.json, set { "functions": { "app/api/**/route.ts": { "maxDuration": 300 } } }.
Give the outbound fetch an AbortController of ~295s so it never dangles past the platform limit.
Commit, push, redeploy (function-config changes require a redeploy).
Verify:

bash

curl -s --max-time 310 -w "\n[%{time_total}s]\n" -X POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute \
 -H "Content-Type: application/json" -H "x-api-key: <PUREMUON_API_KEY>" \
 -d '{"input":"Find the CMO of Vercel","conversationId":"test-123"}' | head -c 1500
