# Repository Summary: Prospect Lens Console

> Auto-maintained by Sim Development. Last updated: 2026-07-31T14:47:09.656Z.

## Overview

A conversational console for finding, selecting, and enriching professional contacts via the Prospect Lens workflow API.

**Repository:** `prospectlens-v10`  
**File count:** 32

## Features

- Chat interface with Markdown rendering, candidate cards, and CSV export tools
- POST /api/chat proxying the Prospect Lens workflow with stable per-session conversationId
- Quick phrase chips and numbered quick-pick selection buttons
- Per-conversation rate limiting and GET /api/health endpoint
- Deep navy ambient design with particle network background
- Arena email gating with access-denied page and iframe-safe headers

## Tech Stack

- Next.js ^15.3.3 (App Router)
- React ^19.0.0
- Tailwind CSS v3
- TypeScript
- Prisma + PostgreSQL (Neon on Vercel)

## Infrastructure

- **Neon project ID:** `royal-tree-79627436` — managed by Sim Development; do not delete or replace
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
- `.gitignore`
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
- `.gitignore`
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

- **Updated at:** 2026-07-31T14:47:09.656Z
- **Request:** Build a Node.js + Express chat web app called "Prospect Lens Console" — a single-page conversational interface for finding, selecting, and enriching professional contacts.

Backend (Node.js / Express)
Single endpoint POST /api/chat that accepts { message, conversationId } and calls the deployed Prospect Lens workflow API, forwarding message as the workflow input and passing a stable conversationId (generate a UUID per browser session and persist it in localStorage — this is critical: the flow keys all state on conversation_id, so the same id must be sent every turn for selection and export to work).
Read the workflow API key and endpoint URL from env vars (PROSPECTLENS_API_URL, PROSPECTLENS_API_KEY); never hardcode them, never change them also.
URL;- https://agent.thearena.ai/api/workflows/93554407-b92d-4ec6-ba3c-be07be4c153b/execute
Key:- sk-sim-W5XWd6ZvGvHrB4qoYLMw_JCEgy_i6YPr
The workflow returns a single chat-style text reply (numbered candidate cards on a search turn, an enriched contact with email on a selection turn, or a Markdown+CSV table on export). Return that reply as { reply }. Do not attempt to parse or re-render internal JSON — the flow already emits clean plain text/Markdown.
Add GET /api/health and basic per-session rate limiting.
Frontend (chat UX)
A clean, modern chat interface: message bubbles, streaming-style typing indicator while the workflow runs (searches can take 60–90s — show a friendly "Searching public professional sources…" loader, never a spinner that looks stuck).
Render the assistant's Markdown (tables, bold, lists) properly — the export turn returns a Markdown table + a fenced CSV block; show the table nicely and give the CSV block a one-click "Copy CSV" and "Download .csv" button.
Pre-typed quick phrases as clickable chips above the input, e.g.: "Find the CMO of Vercel", "VP of Sales at Notion", "Show all my contacts", "Head of Marketing at Stripe". Clicking a chip sends it as the message.
Selection helper: when the last assistant message contained numbered cards, show quick-pick buttons 1 2 3 All that send that number as the next message (the flow treats a lone number as a pick).
Natural language: the user can type any sentence — the workflow's parser handles it. Do not constrain input to a form.
Card readability: when the reply is a numbered candidate list, render each as a clean card (name, title, company, location, confidence). Keep it scannable.
Visual design (must match house style)
Deep navy/black background (not pure black), with subtle radial gradients and soft ambient glows in blue, purple, and teal.
A very low-opacity particle/network pattern behind the chat to give an "intelligence platform" feel.
Clean sans-serif, generous spacing, rounded cards, smooth transitions.
Hard rules
Never display raw JSON anywhere in the UI — always render the assistant's text/Markdown.
Never surface internal tool/provider names, errors, IDs, or stack traces to the user.
Never show phone numbers.
A contact with no email is still shown (mark "email not found"), never dropped.
Deliverables
server.js, public/index.html, public/app.js, public/styles.css, package.json, .env.example (PROSPECTLENS_API_URL, PROSPECTLENS_API_KEY), and a README.md with run instructions.
