# Prospect Lens Console

A conversational console for finding, selecting, and enriching professional contacts, powered by the Arena Prospect Lens workflow API.

## Features

- Chat interface with quick-pick candidate numbers and quick phrase chips
- Streams the Arena workflow execute endpoint with the full `selectedOutputs` list (candidates, enrichment, exports)
- Robust SSE/stream response parsing with prioritized workflow output keys
- Phone number redaction on assistant replies
- Best-effort chat logging to Postgres via Prisma
- Arena email gate (iframe-safe cookies + access-denied page)

## Tech Stack

- Next.js ^15.3.3 (App Router) + React ^19
- Tailwind CSS v3 + Arena DS tokens
- TypeScript (strict)
- Prisma + PostgreSQL (Neon on Vercel)

## API Configuration

The app calls the Prospect Lens workflow at:

```
POST https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute
```

with headers `X-API-Key` and `Content-Type: application/json`, body `{ input, stream: true, selectedOutputs: [...] }`.

Defaults are baked in; override with environment variables:

- `PROSPECTLENS_API_URL` — workflow execute URL
- `PROSPECTLENS_API_KEY` — workflow API key

## Local Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `DATABASE_URL`
3. `npm run dev`

## Deploy

Vercel build runs `prisma generate && prisma db push && next build`. `DATABASE_URL` is injected by the Neon integration.
