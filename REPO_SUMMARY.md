# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-05T15:37:21.021Z.

## Overview

Prospect Lens Console — search for professional contacts via the Prospect Lens workflow, render candidate cards, and enrich verified work emails per contact.

**Repository:** `prospectlens-v10`  
**File count:** 37

## Features

- Identify contacts via /api/identify with { query, conversationId } and render cards from contacts[]
- Per-contact enrichment via /api/enrich ({ id, conversationId, full_name, company_name }) — one credit per person
- Enrich selected loops sequentially, one request per contact, merging work_email/status by id
- Client-side computed counts (enriched / no email) — never read from the API
- CSV export with real fields: full_name, title, company_name, location, seniority, work_email, status, linkedin_url
- Stable conversationId persisted in component state and echoed on every identify/enrich call

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

- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
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
- `app/api/health/route.ts`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`
- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
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

- **Updated at:** 2026-08-05T15:37:21.021Z
- **Request:** The app is now pointed at the Prospect Lens workflow. /api/identify/route.ts and /api/enrich/route.ts have already been rewritten to call Prospect Lens and return a specific JSON shape. Do not change those two route files. The problem is app/page.tsx still uses the OLD API contract, so cards and emails don't render. Fix page.tsx (and the small items below) to match the routes exactly. Change ONLY data-wiring/logic — do not alter the visual design, layout, styling, or copy.

1. Fix the identify request/response wiring in page.tsx → runIdentify()

The identify route reads only query (and optional conversationId) and returns { conversationId, contacts, message }. It does NOT return reply, company, mode, counts.
Persist the returned conversationId in component state (add const [conversationId, setConversationId] = useState('')) and send it back on every subsequent identify/enrich call.
Replace reads of data.reply with data.message; render that message in the existing reply panel (keep the reply state variable/UI, just feed it from data.message).
Remove the data.company / company handling and the data.mode === 'no_company' branch (the route never sends them). Keep a simple empty-state message when contacts is empty, driven off data.message.
Drop the advanced-search fields from the request body (route ignores company_domain, titles, limit, seniorities). Either keep the advanced UI purely cosmetic or fold its values into the query string — do not send unused keys.
2. Fix the enrich request/response wiring in page.tsx → enrich()

The enrich route enriches ONE candidate per call and expects body { id, conversationId, full_name, company_name }. It returns { id, work_email, status, message } where status is 'enriched' or 'no_email'.
Change enrich() to take a single contact (not an array of ids). For "Enrich selected", loop and call the route once per selected contact (sequentially) so each spends exactly one credit for one person.
Send the full contact fields the route needs: { id: c.id, conversationId, full_name: c.full_name, company_name: c.company_name }.
On response, merge by id: set that contact's work_email and status from the response. Remove the old data.contacts[] / byId bulk-merge and the data.enriched/offTarget/unmatched counts handling (the route doesn't return those).
3. Reconcile the counts UI

The routes never return enriched/offTarget/unmatched. Either remove the counts pill bar, or compute it client-side from contacts (e.g. count status === 'enriched' and status === 'no_email'). Do not read counts from the API response.
4. Fix the Contact type / field names to match the route output

Identify returns each contact as: { id, full_name, title, company_name, location, seniority, confidence, linkedin_url, photo_url, work_email:'', status:'identified' }.
The card currently reads c.company || c.company_name — keep that fallback, but ensure company_name is the primary field used everywhere (CSV export currently uses company, which will be blank — change export column to company_name).
Remove references to fields the routes never send: apollo_person_id, email_status, email_deliverable, matched_org, email_company_match, enriched_offtarget. Simplify the post-enrich badges to: verified/found when work_email is present (status === 'enriched'), and "No email" when status === 'no_email'. Drop the off-target ("amber") branch entirely.
5. CSV export

Update the export columns to the real fields: ['full_name','title','company_name','location','seniority','work_email','status','linkedin_url'].
6. Env / config (already correct — verify only)

.env.example and .env.local.example already define PROSPECT_LENS_URL and PROSPECT_LENS_API_KEY. Confirm next.config.js / any config doesn't still reference the old pure-muon vars. The user must set a real PROSPECT_LENS_API_KEY in Vercel + local .env.local.
Acceptance criteria

After a search, cards render immediately from contacts[] with name, title, company, location, seniority, avatar, LinkedIn — no email shown yet.
Clicking "Get email" on a card calls enrich once for that person and populates work_email on that card (verified email like dshah@hubspot.com appears); "Enrich selected" does the same per selected card.
Phone is never displayed anywhere.
No runtime reads of data.reply, data.company, data.counts, or data.contacts (bulk) remain.
