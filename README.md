# prospectlens-v10

Prospect Lens Console with a right-side History panel: past search sessions loaded from the chat-history workflow keyed by the Arena session email, with the same enrich and CSV-export functionality. All workflow calls now include the session email.

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
