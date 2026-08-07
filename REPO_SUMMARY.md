# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-07T11:33:10.179Z.

## Overview

Prospect Lens Console with a right-side History panel: past search sessions loaded from the chat-history workflow keyed by the Arena session email, with the same enrich and CSV-export functionality. All workflow calls now include the session email.

**Repository:** `prospectlens-v10`  
**File count:** 44

## Features

- Right-side History panel listing past search sessions from the chat-history workflow
- History sessions support Enrich (via /api/enrich with the stored conversation_id) and Export CSV
- Session email from the Arena cookie is included in every PROSPECT_LENS_URL workflow request
- Existing console UI, chat UI, identify/enrich flows unchanged

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
- `app/console-polish.css`
- `app/error.tsx`
- `app/globals.css`
- `app/history-polish.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`

### API routes

- `app/api/chat/route.ts`
- `app/api/enrich/route.ts`
- `app/api/health/route.ts`
- `app/api/history/route.ts`
- `app/api/identify/route.ts`

### Components

- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
- `components/HistoryPanel.tsx`
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
- `app/api/history/route.ts`
- `app/api/identify/route.ts`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/console-polish.css`
- `app/error.tsx`
- `app/globals.css`
- `app/history-polish.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`
- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
- `components/HistoryPanel.tsx`
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

- **Updated at:** 2026-08-07T11:33:10.179Z
- **Request:** CRITICAL: Don't change any UI 

Add the history list to the right section, don't change any other UI, 
Add all the funcationalities what you have done for this API PROSPECT_LENS_URL, 
export csv, enrich add these in the History as well maitian the same functionalities 

1) for the API 
PROSPECT_LENS_URL=https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute\nPROSPECT_LENS_API_KEY=sk-sim-FKxMxim0lRkjj3Ssw3oh4lAGF9Ewaz25

Include email in the request take the email from the session 


2) Chat history API :

Request :
curl -X POST \
  -H "X-API-Key: sk-sim-FKxMxim0lRkjj3Ssw3oh4lAGF9Ewaz25" \
  -H "Content-Type: application/json" \
  -d '{"email":"email from the session ","stream":false,"selectedOutputs":["table1.rows"]}' \
  https://agent.thearena.ai/api/workflows/85c915ed-d7fc-4d76-ab1e-c1a93ca163ba/execute


sample response 
{
    "success": true,
    "executionId": "a1c1eb84-cb53-47e9-8df9-1ac80cab2274",
    "output": {
        "rows": [
            {
                "id": "row_c617793783244ac5aac76dba0cf5d4b7",
                "data": {
                    "message": "I can help you find professional contacts by searching for specific roles at companies. For example, you can ask for the VP of Sales at Notion, and I'll find matching people for you. Let me know who you're looking for!",
                    "updated_at": "2026-08-03T12:13:57.733Z",
                    "candidates_json": "[]",
                    "last_updated": "2026-08-03T12:13:57.734Z",
                    "conversation_id": "8c8372b8-024f-404c-8e24-b2fd633b2f3f",
                    "email": "abc"
                },
                "executions": {},
                "position": 0,
                "orderKey": "a0",
                "createdAt": "2026-08-03T12:12:55.838Z",
                "updatedAt": "2026-08-07T11:00:35.286Z"
            }
        ],
        "rowCount": 1,
        "totalCount": 1,
        "limit": 100,
        "offset": 0
    },
    "metadata": {
        "duration": 441.2442609965801,
        "startTime": "2026-08-07T11:08:50.662Z",
        "endTime": "2026-08-07T11:08:51.103Z"
    }
}
