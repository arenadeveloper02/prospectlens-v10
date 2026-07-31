# Prospect Lens Console

A single-page conversational console for finding, selecting, and enriching professional contacts. Chat naturally ("Find the CMO of Vercel"), pick a numbered candidate to enrich it with a verified email, and export everything as a Markdown table + downloadable CSV.

## Features

- **POST /api/chat** — proxies `{ message, conversationId }` to the deployed Prospect Lens workflow and returns `{ reply }`
- **GET /api/health** — liveness check
- Per-conversation rate limiting (10 requests / minute)
- Stable per-browser conversation UUID stored in a `Secure; SameSite=None` cookie so the workflow keeps selection/export state across every turn
- Friendly rotating loader for long searches (60–90s), Markdown rendering (tables, bold, lists), CSV block with **Copy CSV** and **Download .csv**
- Quick phrase chips, numbered-card quick picks (1 / 2 / 3 / All), particle-network ambient background
- Never displays raw JSON, internal errors, or phone numbers

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v3 + custom design tokens (Poppins via next/font)
- Prisma + Neon Postgres (best-effort chat transcript logging)

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and PROSPECTLENS_API_KEY
npm run dev
```

Open http://localhost:3000/?emailId=you@example.com (the Arena email gate requires an `emailId` query parameter on first load).

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (auto-injected on Vercel + Neon) |
| `PROSPECTLENS_API_URL` | Prospect Lens workflow execute endpoint |
| `PROSPECTLENS_API_KEY` | Workflow API key |

## Deploy

Deploy to Vercel with a connected Neon database. The build script runs `prisma generate && prisma db push && next build`. Set `PROSPECTLENS_API_URL` and `PROSPECTLENS_API_KEY` in the project environment.
