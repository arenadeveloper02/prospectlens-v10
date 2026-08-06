# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-06T11:33:38.115Z.

## Overview

A conversational console for finding, selecting, and enriching professional contacts via the Prospect Lens workflow.

**Repository:** `prospectlens-v10`  
**File count:** 41

## Features

- Leadership contact search via workflow
- Selection-driven email enrichment
- Generated monogram avatars with photo fallback
- Welcome panel and quick-insert prefix chips
- CSV export of contacts
- Chat message logging to Postgres

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

- `AppSetting`
- `ChatMessage`

## File Inventory

### App pages

- `app/access-denied/page.tsx`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/console-polish.css`
- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`

### API routes

- `app/api/chat/route.ts`
- `app/api/enrich/route.ts`
- `app/api/health/route.ts`
- `app/api/identify/route.ts`

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
- `app/api/identify/route.ts`
- `app/arena-ds-tokens.css`
- `app/chat-polish.css`
- `app/console-polish.css`
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

- **Updated at:** 2026-08-06T11:33:38.115Z
- **Request:** App-only changes to app/page.tsx. Do not change any workflow, the API routes, the enrichment logic, or the working output shape. Keep all existing class names so globals.css styling is preserved. Only add/replace the pieces below.

1. Generated avatar (photo when available, monogram otherwise)
Replace the Avatar component and add a gradient helper above it:

tsx

function avatarGradient(name?: string) {
 const s = name || '?';
 let h = 0;
 for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
 const h2 = (h + 40) % 360;
 return `linear-gradient(135deg, hsl(${h} 68% 34%), hsl(${h2} 72% 22%))`;
}

function Avatar({ c }: { c: Contact }) {
 const [err, setErr] = useState(false);
 if (c.photo_url && !err) {
 // eslint-disable-next-line @next/next/no-img-element
 return <img className="avatar" src={c.photo_url} alt={c.full_name} onError={() => setErr(true)} />;
 }
 return (
 <div
 className="avatar"
 style={{ background: avatarGradient(c.full_name), color: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, letterSpacing: '0.5px' }}
 >
 {initials(c.full_name)}
 </div>
 );
}
Same .avatar class → size/shape/border unchanged. Every card now looks finished; real headshots still show whenever the workflow supplies photo_url.

2. Welcome message on open
Directly under the existing .hero block, add a welcome panel (shown only before the first search — when there are no results, no reply, and not loading):

tsx

{!hasResults && !reply && !loading && (
 <div className="welcome">
 <div className="welcome-title">👋 Welcome to Leadership Finder</div>
 <p>Find any company&apos;s decision-makers in seconds, then unlock verified work emails only for the people you choose — no wasted credits.</p>
 <ol className="welcome-steps">
 <li><b>Search</b> a role + company (or tap a quick-insert below).</li>
 <li><b>Review</b> the leadership cards we surface.</li>
 <li><b>Enrich</b> the ones you want to get a verified email.</li>
 </ol>
 </div>
)}
3. Quick-insert prefix chips under the search bar
Add this constant near EXAMPLES:

tsx

const QUICK_PREFIXES = ['C-Level of ', 'CEO of ', 'VP of ', 'Managing Director of ', 'Director of '];
Immediately after the .searchbar div, insert a chip row that fills the box with the prefix and focuses the input so the user just types the company:

tsx

<div className="quick-inserts">
 {QUICK_PREFIXES.map((p) => (
 <button
 key={p}
 className="qi-chip"
 onClick={() => {
 setQuery(p);
 const el = document.querySelector<HTMLInputElement>('.searchbar input');
 if (el) { el.focus(); const n = p.length; requestAnimationFrame(() => el.setSelectionRange(n, n)); }
 }}
 >
 {p.trim()}
 </button>
 ))}
</div>
Give the search input an id/aria for that selector + accessibility:

tsx

<input
 aria-label="Search for a role and company"
 /* ...keep existing props... */
/>
4. Small polish
Update EXAMPLES so the empty-state chips match the new pattern:

tsx

const EXAMPLES = ['CEO of Figma', 'C-Level of Notion', 'VP of Marketing at Stripe', 'Director of Sales at Canva'];
5. Styles (append to app/globals.css, on-brand dark theme)
css

.welcome { margin: 14px 0 18px; padding: 18px 20px; border-radius: 18px;
 background: linear-gradient(135deg, rgba(124,108,255,0.10), rgba(77,184,255,0.06));
 border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(8px); }
.welcome-title { font-size: 18px; font-weight: 800; color: #F5F7FA; margin-bottom: 6px; }
.welcome p { color: rgba(245,247,250,0.7); margin: 0 0 10px; }
.welcome-steps { margin: 0; padding-left: 18px; color: rgba(245,247,250,0.75); display: grid; gap: 4px; }
.quick-inserts { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 4px; }
.qi-chip { padding: 7px 14px; border-radius: 999px; font-size: 13px; cursor: pointer;
 color: #F5F7FA; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10);
 transition: all .18s ease; }
.qi-chip:hover { border-color: rgba(124,108,255,0.6); box-shadow: 0 0 0 3px rgba(124,108,255,0.12);
 transform: translateY(-1px); }
