# prospectlens-v10

Prospect Lens Console restyled with the standing LIGHT theme (thearena.ai-inspired): airy near-white canvas with soft indigo/violet glows, white surfaces with hairline borders, dark ink text, and the purple→blue accent gradient — colors only, with all layout, class names, avatar logic, welcome panel, quick-insert chips, and the identify → enrich → export flow preserved.

## Features

- Light theme: #f7f8fb canvas with subtle indigo/violet radial glows
- White surfaces with hairline borders and soft low-spread shadows
- Dark ink text hierarchy (#0F172A primary, muted slate secondary, faint tertiary)
- Purple→blue accent gradient (#7C6CFF → #4DB8FF) on primary buttons, links, and avatar monograms
- Soft indigo focus/hover glow ring rgba(124,108,255,0.18)
- Light-appropriate status tints: verified green, unavailable amber, error red
- Identify → select → enrich → CSV export flow fully preserved

## Tech Stack

- Next.js ^15.3.3 (App Router)
- React ^19.0.0
- Tailwind CSS v3
- TypeScript
- Prisma + PostgreSQL (Neon on Vercel)

## Routes

- `/`
- `/access-denied`

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

1. Copy `.env.example` to `.env` for local development
2. Set `DATABASE_URL` to your Postgres connection string
3. Run `npx prisma db push` before `npm run dev` if tables are missing

On Vercel, `DATABASE_URL` is injected when Neon is connected to the project.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — production build (runs Prisma generate/push when configured)
- `npm run start` — run the production server locally

## Deploy

This project is intended for deployment on [Vercel](https://vercel.com). Connect the GitHub repository and deploy the `main` branch.
