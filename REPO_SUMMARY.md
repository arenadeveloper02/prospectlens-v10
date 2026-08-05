# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T14:39:47.835Z.

## Overview

Prospect Lens Console — conversational prospect search with pre-enrichment candidate cards, multi-select, and one-shot Apollo enrichment merged back onto the same cards.

**Repository:** `prospectlens-v10`  
**File count:** 36

## Features

- Identify results render immediately as selectable candidate cards (before enrichment)
- Multi-select with Select all / Clear controls and a sticky Enrich N selected button
- Single enrich request for all selected ids (enrich: <ids>) on the same conversationId
- Per-card loading spinner during enrichment; results merged in place (email + copy, or muted No email available)
- Dark-enterprise glass cards with glowing selected borders and purple→blue gradient pills

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
- `lib/enrich-extract.ts`
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
- `lib/enrich-extract.ts`
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

- **Updated at:** 2026-08-05T14:39:47.835Z
- **Request:** Prospect Lens — show identified contacts as selectable cards BEFORE enrichment, with multi-select + an Enrich button.

Problem to fix: Right now the identified contacts do not render before enrichment. Cards only appear after Apollo enrichment runs. I want the identify results to appear as a card list immediately, let the user select multiple, and only then enrich the selected ones.

Do not change any workflow logic, the identify search, or the enrichment call. This is a frontend/UI change only. Do not alter layout structure beyond adding the pre-enrichment card grid, selection, and Enrich button. Preserve all existing content and functionality.

1. Render identify results as cards (pre-enrichment). The identify/search response already returns a candidates array. Each item has: id, name, title, company, company_domain, location, seniority_level, confidence, photo_url, linkedin_url, summary. As soon as this array arrives, render it as a card grid — do NOT wait for enrichment. Hide the plain text intro once cards are present.

Each card shows:

Profile picture — photo_url in a rounded avatar with a soft ring. photo_url can be null: on empty or image onError, fall back to a circular initials avatar generated from name. Never show a broken image.
Name (bold), title, company, location.
Seniority and confidence as small badges.
LinkedIn — if linkedin_url is present, a pill "View LinkedIn" button opening it in a new tab (target="_blank" rel="noopener"); hide the button if linkedin_url is null.
No email at this stage (none exists yet).
2. Multi-select + Enrich button.

Each card is selectable via a checkbox (or click-to-toggle) with a glowing border on selected cards.
Add "Select all" / "Clear" controls above the grid.
A sticky "Enrich N selected" button below the grid, disabled when nothing is selected.
On click, send only the selected candidates to the existing enrich step in ONE request, keeping the same conversationId for the session so the workflow can match candidates by their stored id: { "input": "enrich: <comma-separated selected ids>", "conversationId": "<same session id>" } (Match the exact shape the enrich branch already expects — it keys off the candidate id.)
Show a per-card loading spinner on the selected cards only while enrichment runs; keep unselected cards untouched.
3. Merge enrichment results back onto the SAME cards. When the enrich response returns, update each selected card in place — do not render a separate list. For each returned { id, email, email_status }:

If email is present → show it with a copy button.
If email_status is unavailable / no email → show a muted "No email available". Apollo-only: no personal or guessed-email fallback. Do not show phone.
Design: Apply the dark-enterprise design language — deep navy background, rounded 16–20px glass cards with thin glowing borders, avatar soft ring, purple→blue gradient pill buttons with soft hover glow, muted secondary text, 8px spacing system.
