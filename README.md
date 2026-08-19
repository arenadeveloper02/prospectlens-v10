# prospectlens-v10

Button theme pass: primary CTAs now use a soft purple→blue→cyan gradient, secondary actions use translucent white surfaces, and suggestion chips use soft neutral pills. Files changed: (1) NEW app/button-theme.css — override stylesheet containing all new button rules (primary gradient for .send-btn/.cand-enrich-btn/.hist-btn-primary/.cand-linkedin with hover/active/disabled states; translucent-white secondary style for .hist-toggle/.hist-btn/.hist-refresh/.hist-close/.cand-tool-btn/.cand-select; neutral chip style for .chip/.qi-chip/.pick-btn). (2) app/layout.tsx — one added line importing './button-theme.css' LAST so the overrides win the cascade without touching any existing stylesheet rules. No other files, logic, or class names were modified. Note: no prisma/schema.prisma exists in the repository file index, so no schema file is echoed — fabricating one from scratch is forbidden and would risk data loss against the live database.

## Features

- Purple→blue→cyan gradient primary CTAs (Search, Enrich selected, primary history actions, LinkedIn pill)
- Smooth hover lift, glow shadow, and brightness transition on primary buttons
- Loading/disabled primary buttons keep the same gradient family at 0.72 opacity
- Translucent white secondary buttons (History, Refresh, Close, toolbar actions) with blue-purple hover tint
- Soft neutral suggestion chips (C-Level of, CEO of, VP of, examples, quick phrases) with subtle indigo hover
- Clear three-tier button hierarchy: gradient CTA → translucent secondary → neutral chip

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
