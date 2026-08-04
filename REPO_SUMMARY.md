# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-04T14:26:30.884Z.

## Overview

Prospect Lens Console — a conversational console for finding, selecting, and enriching professional contacts. This edit hardens reply extraction (strict 4-field whitelist, JSON/internal-payload guard, stricter quick-pick and CSV detection) and polishes the chat UI (role labels, relative timestamps, warning-styled fallback replies, welcome panel, fade-in animation, mobile pass).

**Repository:** `prospectlens-v10`  
**File count:** 33

## Features

- Strict whitelist reply extraction in lib/prospectlens.ts — only presentcards.content, formatexport.content, apollocontactfinder.content, identify.message; serialize* outputs and all generic fallbacks removed
- Defense-in-depth guard in app/api/chat/route.ts: replies that parse as JSON or contain internal field markers fall back to FRIENDLY_FAILURE
- Quick-pick buttons now require a second signal (company/title context or reply-with-number phrasing) beyond mere numbering
- CSV detection requires consistent comma counts across all lines before showing copy/download UI
- Role indicators (You / Prospect Lens) and relative timestamps (updated every 30s) on every bubble
- Warning-tinted styling on fallback/error replies so users can tell at a glance a request didn't fully complete
- Welcome bubble upgraded to a getting-started panel with subtle brand glow
- CSS-only fade/slide-in for new bubbles and a 375px mobile pass (scrollable chips/quick-picks, non-overflowing composer, scrollable tables)

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

- `components/ChatClient.tsx`
- `components/Markdown.tsx`
- `components/ParticleField.tsx`
- `components/QuickChips.tsx`
- `components/TypingIndicator.tsx`
- `components/arena-email-provider.tsx`

### Libraries

- `lib/arena-email-constants.ts`
- `lib/arena-email.ts`
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
- `components/ChatClient.tsx`
- `components/Markdown.tsx`
- `components/ParticleField.tsx`
- `components/QuickChips.tsx`
- `components/TypingIndicator.tsx`
- `components/arena-email-provider.tsx`
- `lib/arena-email-constants.ts`
- `lib/arena-email.ts`
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

## Latest Change

- **Updated at:** 2026-08-04T14:26:30.884Z
- **Request:** You are working in the `prospectlens-v10` repo (Next.js 15 App Router). Do NOT touch 
middleware.ts, the rate-limiter in app/api/chat/route.ts, anything related to 
PROSPECTLENS_API_KEY / PROSPECTLENS_API_URL / credentials, or the Prisma/DATABASE_URL setup. 
Those are intentionally out of scope for this pass — leave them exactly as they are.

Focus only on: (A) making sure the chat never surfaces wrong/irrelevant/raw internal content 
to the user, and (B) visual polish of the existing UI. Do not change the overall page layout 
or brand (Prospect Lens Console, dark theme with particle background) — refine it, don't 
replace it.

=== A. STOP IRRELEVANT / RAW CONTENT FROM REACHING THE CHAT ===

1. In lib/prospectlens.ts, `extractReply` currently falls back through a long chain: 
   PRIORITY_OUTPUT_KEYS (which includes `serializecandidates.result` and 
   `serializeenriched.result` — these are raw internal JSON payloads, never meant for the 
   user), then any key ending in `.content`/`.message`/`.result`/`.text`/`.reply` anywhere in 
   the object, then a generic REPLY_KEYS list (`reply`, `content`, `text`, `message`, `output`, 
   `result`, `response`, `answer`, `chunk`, `data`) at ANY depth.
   
   Rewrite this so it ONLY ever returns one of these four fields, in this exact priority 
   order, and returns null (never a fallback guess) if none of them are present with 
   non-empty string content:
     1. presentcards.content
     2. formatexport.content
     3. apollocontactfinder.content
     4. identify.message
   Remove serializecandidates.result and serializeenriched.result from consideration 
   entirely — they must never be shown to the user under any circumstance. Remove the 
   generic suffix-matching loop and the REPLY_KEYS fallback loop.
   
   When extractReply returns null, the existing FRIENDLY_FAILURE message in 
   app/api/chat/route.ts should be shown, exactly as it already does today — don't change 
   that part.

2. Add one more defensive check in app/api/chat/route.ts, right before a reply is shown to 
   the user: if the extracted reply still looks like raw JSON or an internal debug payload 
   (e.g. it starts with `{` or `[` and parses as JSON, or it contains the literal substrings 
   `"candidates":`, `"conversation_id":`, `"enrich_status":`, `"selected_ids":`) treat it the 
   same as a null reply and show FRIENDLY_FAILURE instead. Add a short code comment 
   explaining why (defense in depth against ever leaking internal workflow state into chat).

3. In components/ChatClient.tsx, `pickNumbers` currently shows quick-pick number buttons 
   whenever it detects 2+ lines matching `^\d{1,2}[.)]\s+` anywhere in the last assistant 
   message — this can misfire on any numbered list (e.g. plain instructions), not just actual 
   candidate cards. Tighten this: only treat it as a candidate list if the SAME message also 
   contains the word "company" or "title" (case-insensitive) near the numbered lines, OR if 
   the message contains a phrase like "reply with the number" / "which one" (case-insensitive) 
   — i.e. require a second independent signal, not just the numbering pattern alone, before 
   showing quick-pick buttons.

4. In components/Markdown.tsx, `looksLikeCsv` currently treats ANY 2+ line block where every 
   line contains a comma as CSV (e.g. a normal sentence with two commas would false-positive). 
   Tighten it to also require that every line has the SAME number of commas as the first line 
   (a basic column-count consistency check), before rendering it as a CSV block with 
   copy/download buttons.

=== B. VISUAL POLISH (refine existing design, keep the dark/particle theme) ===

5. Add a small role indicator to each message bubble in ChatClient.tsx — e.g. a subtle 
   "You" / "Prospect Lens" label or a small avatar dot, using the existing CSS token 
   variables in app/arena-ds-tokens.css (don't introduce a new color palette).

6. Add a relative timestamp under each message bubble (e.g. "2m ago"), using the 
   `createdAt` field that's already on UiMessage — compute it client-side, update every 
   30s or so.

7. Give the FRIENDLY_FAILURE / error-style replies (the ones from app/api/chat/route.ts 
   fallback messages) a visually distinct treatment from normal assistant replies — e.g. a 
   subtle amber/warning-tinted left border or icon on that bubble — so the user can tell at 
   a glance "this one didn't fully work" vs a normal answer, without it looking broken.

8. Polish the empty/welcome state: keep the current WELCOME copy and QUICK_PHRASES, but give 
   the welcome bubble slightly more visual weight (e.g. larger padding, a subtle border/glow 
   consistent with the existing .glow classes in globals.css) so it reads as an intentional 
   "getting started" panel rather than just the first chat bubble.

9. Add a lightweight fade/slide-in transition (CSS only, no new JS animation library) when a 
   new message bubble is appended, so the conversation doesn't just pop content in abruptly.

10. Do a mobile-width pass (assume ~375px viewport): verify composer input, send button, quick 
    pick row, and chips wrap or scroll sensibly instead of overflowing, and that md-table 
    (candidate/contact tables) becomes horizontally scrollable on narrow screens rather than 
    squeezing columns unreadably. Use the existing .md-table-wrap wrapper for this if it 
    isn't already doing it.

=== ACCEPTANCE CRITERIA ===

- No security, auth, rate-limiting, credential, or database config files are touched.
- A reply that isn't one of the four whitelisted output fields, or that looks like raw 
  internal JSON, always falls back to the existing FRIENDLY_FAILURE copy — never raw JSON 
  or internal field names in the chat.
- Existing working behavior (send message, get reply, quick-pick, CSV copy/download) is 
  unchanged when the workflow returns a normal, well-formed reply.
- Summarize every file changed and why, at the end.

Ask me before making any change not listed above.
