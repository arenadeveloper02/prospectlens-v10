# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T10:14:43.682Z.

## Overview

Prospect Lens Console — conversational contact finding and enrichment, now wired to the updated Prospect Lens workflow endpoint with the structured { reply, mode, cardCount } contract.

**Repository:** `prospectlens-v10`  
**File count:** 33

## Features

- Chat console for finding, selecting, and enriching professional contacts
- Updated workflow endpoint (93554407-b92d-4ec6-ba3c-be07be4c153b) with new API key, overridable via PROSPECTLENS_API_URL / PROSPECTLENS_API_KEY env vars
- Structured response parsing: reads data.result.reply / data.output.reply / top-level reply from the workflow JSON, with SSE-stream fallback
- 120s request timeout matching the workflow contract
- Defense-in-depth reply sanitisation (internal payload detection + phone redaction) so raw workflow state never reaches the chat
- Rate limiting, best-effort Prisma chat logging, Arena email gate, and CSV export UI all preserved

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

- **Updated at:** 2026-08-05T10:14:43.682Z
- **Request:** .env — copy verbatim
PROSPECTLENS_API_URL=https://agent.thearena.ai/api/workflows/93554407-b92d-4ec6-ba3c-be07be4c153b/execute
PROSPECTLENS_API_KEY=sk-sim-CM-viQzIdS99ZG4oIMVwQbm1Q3GfgjUx
PORT=3000

Working curl to paste
curl -X POST https://agent.thearena.ai/api/workflows/93554407-b92d-4ec6-ba3c-be07be4c153b/execute \
 -H "X-API-Key: sk-sim-CM-viQzIdS99ZG4oIMVwQbm1Q3GfgjUx" \
 -H "Content-Type: application/json" \
 -d '{"input":"CMO of Vercel","conversationId":"test-session-001"}'


Backend for app
const r = await fetch(process.env.PROSPECTLENS_API_URL, {
 method: "POST",
 headers: {
 "X-API-Key": process.env.PROSPECTLENS_API_KEY,
 "Content-Type": "application/json",
 },
 body: JSON.stringify({ input: message, conversationId }),
 signal: AbortSignal.timeout(120_000),
});
const data = await r.json();
// structured contract from the flow: { reply, mode, cardCount }
res.json(data.result ?? { reply: data.output ?? data.content ?? data });



Make sure you are clear about everything. Use the values and details at right places. The result should be visible properly
