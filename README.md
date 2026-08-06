# prospectlens-v10

Prospect Lens Console — added generated avatars (photo with monogram fallback), a first-open welcome panel, quick-insert prefix chips under the search bar, and refreshed example chips. No workflow, API route, or enrichment logic changed.

## Features

- Generated gradient monogram avatars with photo fallback on every contact card
- Welcome panel shown before the first search explaining the identify → review → enrich flow
- Quick-insert prefix chips (C-Level of, CEO of, VP of, …) that pre-fill and focus the search input
- Example query chips in the empty state matching the new search pattern
- Identify + selective enrich flow with CSV export preserved unchanged

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
