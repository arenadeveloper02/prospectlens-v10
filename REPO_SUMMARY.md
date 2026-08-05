# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T14:23:20.753Z.

## Overview

Prospect Lens Console — conversational prospect search with rich candidate cards (avatar, LinkedIn, badges) parsed from the workflow's Identify block.

**Repository:** `prospectlens-v10`  
**File count:** 35

## Features

- Chat console with stable per-session conversationId
- Structured candidate cards parsed from the Identify block (photo, LinkedIn, seniority/confidence badges)
- Initials avatar fallback when photo_url is missing or broken
- Numbered Select affordance that sends the stored candidate id back to the workflow
- Present Cards agent text rendered as the lead-in above the cards
- CSV export rendering with copy/download
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

- **Updated at:** 2026-08-05T14:23:20.753Z
- **Request:** Prospect Lens v10 — render candidate cards with profile picture + LinkedIn link.

The search response already includes a candidates array (from the Identify step). Each item has: id, name, title, company, company_domain, location, seniority_level, confidence, photo_url, linkedin_url, summary. Today the UI only shows the intro sentence — it must map this array into cards.

From the execute response, read the candidates array (it's on the Identify block's output — log the raw JSON once to confirm the exact path, e.g. output["Identify"].candidates). Use the Present Cards text as the section heading above the cards.
Render one card per candidate:
Profile picture: <img src={photo_url}> in a rounded avatar. photo_url can be null — when it's empty or the image fails to load (onError), fall back to a circular initials avatar (first letters of name). Never show a broken image icon.
Name (bold), title, company, location.
Seniority and confidence as small badges.
LinkedIn link: if linkedin_url is present, render a "View LinkedIn" button/icon opening linkedin_url in a new tab (target="_blank" rel="noopener"). Hide the link if linkedin_url is null.
A numbered "Select" affordance showing the candidate's id.
Never show email or phone here (none exists at this stage).
On select, send { "input": "<id number>", "conversationId": "<same session id>" } — the workflow matches by stored id, so keep conversationId stable across the session.
Apply the workspace dark-enterprise design language: rounded 16–20px glass cards, thin glowing borders, avatar with a soft ring, pill "View LinkedIn" button with the purple→blue gradient, muted secondary text for title/company/location.
