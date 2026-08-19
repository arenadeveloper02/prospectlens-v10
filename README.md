# prospectlens-v10

Prospect Lens console restyled to the Arena Design System (brand blue #1A73E8, grey text hierarchy, white surfaces, DS tokens) with the History panel moved from a persistent right-side column to a top 'History' button that opens a slide-over drawer. Files changed: app/globals.css, app/chat-polish.css, app/console-polish.css, app/history-polish.css (color-only Arena DS token pass + new drawer/toggle styles), app/layout.tsx (render HistoryToggle instead of the fixed right-side HistoryPanel), components/HistoryToggle.tsx (new client component wrapping the existing HistoryPanel in a button-triggered drawer). prisma/schema.prisma is not present in the repository file index, so no schema file was touched.

## Features

- Arena DS token-based light theme (brand blue #1A73E8, grey hierarchy, white surfaces, Poppins)
- History accessible via a top History button that opens a slide-over drawer
- Identify leadership contacts and enrich verified emails
- Session history with enrich + CSV export

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
