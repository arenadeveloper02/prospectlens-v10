# Repository Summary: Prospect Lens Console

> Auto-maintained by Sim Development. Last updated: 2026-08-19T07:38:16.959Z.

## Overview

A conversational console for finding, selecting, and enriching professional contacts, with a soft blue/purple SaaS button theme.

**Repository:** `prospectlens-v10`  
**File count:** 39

## Features

- Leadership contact search via Arena workflow
- Selective contact enrichment with verified emails
- History drawer with per-session enrich and CSV export
- CSV export of results
- Soft purple→blue→cyan gradient primary buttons with translucent secondary actions
- Arena email gate with access-denied page

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

## File Inventory

### App pages

- `app/access-denied/page.tsx`
- `app/arena-ds-tokens.css`
- `app/button-theme.css`
- `app/chat-polish.css`
- `app/console-polish.css`
- `app/globals.css`
- `app/history-polish.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`

### Components

- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
- `components/HistoryPanel.tsx`
- `components/HistoryToggle.tsx`
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

- `README.md`
- `REPO_SUMMARY.md`

## Complete File Index

- `.env.example`
- `README.md`
- `REPO_SUMMARY.md`
- `app/access-denied/page.tsx`
- `app/arena-ds-tokens.css`
- `app/button-theme.css`
- `app/chat-polish.css`
- `app/console-polish.css`
- `app/globals.css`
- `app/history-polish.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/page.tsx`
- `components/CandidateCards.tsx`
- `components/ChatClient.tsx`
- `components/HistoryPanel.tsx`
- `components/HistoryToggle.tsx`
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

- **Updated at:** 2026-08-19T07:38:16.959Z
- **Request:** Implement the following functionality in the codebase. Do not modify, refactor, remove, or "clean up" any other part of the code beyond what is explicitly listed below. Preserve existing formatting, naming conventions, comments, and logic in all unrelated sections.
Changes to implement:



1) change the CSS 
Also update all primary and secondary buttons so they visually match the new soft blue / purple SaaS theme.
The current solid bright-blue button style looks too flat and disconnected from the new background.
Primary buttons
Change buttons such as:
	•	View analysis history
	•	Search
	•	Analyze
	•	Continue
	•	Run analysis
from a flat solid blue into a softer premium gradient.
Use a direction similar to:
background: linear-gradient(
  135deg,
  #6d63ff 0%,
  #4f8cff 50%,
  #38bdf8 100%
);
The gradient should feel subtle and premium rather than overly saturated.
Add:
color: #ffffff;

border: 1px solid rgba(255,255,255,0.20);

box-shadow:
  0 8px 24px rgba(79,124,255,0.18),
  0 2px 6px rgba(15,23,42,0.06);

border-radius: 16px;
Example: "View analysis history"
The current button:
View analysis history
should become visually lighter and more refined.
Desired appearance:
	•	purple-blue gradient
	•	white text
	•	softer corners
	•	subtle glow/shadow
	•	no harsh flat blue fill
	•	smooth hover animation
Example:
.analysis-history-button {
  background: linear-gradient(
    135deg,
    #7568ff 0%,
    #5687ff 52%,
    #43b7f5 100%
  );

  color: white;

  border: 1px solid rgba(255,255,255,0.22);

  border-radius: 16px;

  box-shadow:
    0 8px 24px rgba(91,124,255,0.18),
    0 2px 6px rgba(15,23,42,0.05);

  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}
Hover state
On hover:
transform: translateY(-1px);

box-shadow:
  0 12px 30px rgba(91,124,255,0.24),
  0 3px 8px rgba(15,23,42,0.06);

filter: brightness(1.02);
Do not make the button dramatically brighter.
Active state
transform: translateY(0);

box-shadow:
  0 5px 14px rgba(91,124,255,0.18);
Disabled / loading state
For loading buttons such as:
Searching...
do not switch to a completely different pale blue.
Keep the same gradient family and lower the opacity:
opacity: 0.72;
cursor: not-allowed;
The loading state must still visually belong to the primary button system.
Secondary buttons
Buttons such as:
	•	History
	•	Back
	•	Cancel
	•	Secondary actions
should use a translucent white surface:
background: rgba(255,255,255,0.78);

border: 1px solid rgba(148,163,184,0.20);

color: #475569;

box-shadow:
  0 4px 14px rgba(15,23,42,0.04);
On hover:
background: rgba(255,255,255,0.96);

border-color: rgba(99,102,241,0.22);

color: #5b6ef5;
Small action chips
For suggestion buttons such as:
	•	C-Level of
	•	CEO of
	•	VP of
	•	Managing Director of
	•	Director of
keep them neutral instead of using the full gradient.
Use:
background: rgba(255,255,255,0.76);
border: 1px solid rgba(148,163,184,0.18);
color: #475569;
On hover, introduce only a slight blue-purple tint:
background: rgba(238,242,255,0.92);
border-color: rgba(99,102,241,0.20);
color: #5b63d9;
Button hierarchy
The application should now use this visual hierarchy:
Primary CTA
Purple → blue → cyan gradient
        ↓
Secondary actions
Translucent white
        ↓
Suggestion chips
Soft neutral pills
Do not use the same blue fill for every button.
Important
Apply the updated theme consistently to:
	•	View analysis history
	•	Search
	•	Analyze
	•	Searching...
	•	History
	•	Retry
	•	Back buttons
	•	Modal CTAs
	•	Any other primary action buttons
Do not only update one button.
The complete application should now feel like one consistent visual system:
soft ambient background + white/translucent surfaces + purple/blue/cyan primary actions + subtle shadows.




Constraints:

* Only touch the files/functions directly related to the points above.
* Do not change variable names, code style, or structure outside the scope of these changes.
* Do not add extra features, optimizations, or refactors that weren't requested.
* If a change requires touching a shared/common file, make the minimal edit needed and leave everything else untouched.
* After implementing, list exactly which files and lines were changed, and why.


model ChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  emailId        String?
  role           String
  content        String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @default(now()) @updatedAt
}
