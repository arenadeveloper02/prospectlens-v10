# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-04T13:50:39.215Z.

## Overview

Prospect Lens Console — a conversational console for finding, selecting, and enriching professional contacts via the Arena workflow API.

**Repository:** `prospectlens-v10`  
**File count:** 31

## Features

- Chat console wired to the Prospect Lens Arena workflow API with all selected outputs
- Streaming SSE response parsing with priority output extraction
- Quick-pick candidate selection and quick phrase chips
- Markdown rendering with candidate cards, tables, and CSV copy/download
- Improved dark-theme visibility: stronger text contrast, brighter bubbles, dark html base, color-scheme dark
- Conversation logging to Postgres via Prisma (best-effort)
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

- `README.md`
- `REPO_SUMMARY.md`

## Complete File Index

- `.env.example`
- `README.md`
- `REPO_SUMMARY.md`
- `app/access-denied/page.tsx`
- `app/api/chat/route.ts`
- `app/api/health/route.ts`
- `app/arena-ds-tokens.css`
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

- **Updated at:** 2026-08-04T13:50:39.215Z
- **Request:** sk-sim-aqTqmPYK2VyFoSQGH5uHTOGsr-eiY2kD


curl -X POST \
  -H "X-API-Key: $SIM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"example","stream":true,"selectedOutputs":["loadcandidates.success","loadcandidates.rows","serializecandidates.result","serializeenriched.result","saveenriched.success","saveenriched.row","loadallcontacts.success","loadallcontacts.rows","savecandidates.success","savecandidates.row","identify.candidates","identify.message","apollocontactfinder.content","presentcards.content","formatexport.content"]}' \
  https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute


These are the api details, add all


Fix the visibility issues also of the app
