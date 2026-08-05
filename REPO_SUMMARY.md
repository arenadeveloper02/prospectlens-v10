# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T13:09:54.892Z.

## Overview

Prospect Lens Console — a conversational console for finding, selecting, and enriching professional contacts.

**Repository:** `prospectlens-v10`  
**File count:** 35

## Features

- Chat console backed by the Prospect Lens workflow
- Structured candidate cards parsed from the Identify block (name, title, company, location, seniority, confidence, photo, LinkedIn)
- One-tap candidate selection that sends the stored candidate id back to the workflow
- Markdown rendering for enrich/export turns with table + CSV export
- Arena email gate with access-denied page
- Best-effort chat logging to Neon Postgres via Prisma

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

- **Updated at:** 2026-08-05T13:09:54.892Z
- **Request:** Prospect Lens v10 — candidate cards don't render on search turns.

The workflow's visible message and the card data are SEPARATE. The intro sentence is Present Cards.content; the actual card array is Identify.candidates — objects with { id, name, title, company, location, seniority_level, confidence, linkedin_url, photo_url, summary }. Today the UI shows only the sentence.

From the execute response, read BOTH: the message string AND the candidates array. If the workflow now returns a combined { message, candidates } object on the search branch, use that directly; otherwise read the per-block output for the Identify block and pull its candidates.
Render one card per candidates[] item — name, title, company, location, seniority badge, confidence badge, LinkedIn link, photo (photo_url), and a numbered "select" affordance using id. Use Present Cards text as the section heading above the cards. Never show email/phone here (none exists at this stage).
On selection, send the chosen id as { "input": "<number>", "conversationId": "<same session id>" } — the workflow matches by stored id, so keep conversationId stable across the session.
Keep the enrich/export turns rendering as Markdown (enrich returns a text list; export returns a Markdown table + CSV).
