# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-06T11:57:32.909Z.

## Overview

Prospect Lens Console — a conversational console for finding, selecting, and enriching professional contacts, styled with the standing LIGHT theme.

**Repository:** `prospectlens-v10`  
**File count:** 41

## Features

- Leadership contact search via Arena workflow
- Selective email enrichment (Apollo-only, never guessed)
- CSV export of contacts
- Best-effort chat message logging to Postgres
- Arena email gate with access-denied page
- Standing light theme inspired by thearena.ai

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

- `AppSetting`
- `ChatMessage`

## File Inventory

### App pages

- `app/access-denied/page.tsx`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/console-polish.css`
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
- `app/console-polish.css`
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

- **Updated at:** 2026-08-06T11:57:32.909Z
- **Request:** Apply the Leadership Finder app's standing LIGHT theme (inspired by thearena.ai). This is the default for this tool and overrides any dark-theme default. Colors only — never change layout, structure, content, or functionality. Keep all existing class names and CSS variables so nothing reflows.

Palette

Canvas: soft near-white #f7f8fb with subtle indigo/violet radial glows in the corners (low opacity — bright and airy, not flat).
Surfaces (cards, search bar, panels, popovers): white / near-white with light hairline borders (rgba(15,23,42,0.08)) and soft, low-spread shadows. No glassmorphic dark fills.
Text: dark ink primary (#0F172A), muted slate secondary (rgba(15,23,42,0.62)), faint tertiary (rgba(15,23,42,0.40)).
Accent (keep brand): purple→blue gradient (#7C6CFF → #4DB8FF) on primary buttons, links, focus rings, and avatar monograms.
Focus/hover: soft indigo glow ring (rgba(124,108,255,0.18)) — gentle, not harsh.
Status tints (light-appropriate): verified = green, unavailable = amber, error = red — as tinted backgrounds with readable dark text on white.
Rules

Rounded corners, generous whitespace, clean minimal enterprise feel — premium but bright.
Preserve the avatar logic, welcome message, quick-insert chips, and enrichment flow exactly.
If any dark colors are hardcoded in page.tsx inline styles, convert only those color values to the light equivalents above — do not touch the markup or logic.
