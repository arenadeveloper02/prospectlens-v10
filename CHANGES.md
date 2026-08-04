# Change Summary — hardening + visual polish pass

No security, auth, rate-limiting, credential, middleware, or database-config files were touched. The Prisma schema is echoed unchanged in spirit (ChatMessage model preserved; no columns removed or altered).

## Files changed and why

- **lib/prospectlens.ts** — Rewrote `extractReply` to a strict whitelist: it only ever returns `presentcards.content`, `formatexport.content`, `apollocontactfinder.content`, or `identify.message` (in that priority order) and returns `null` otherwise. Removed `serializecandidates.result` / `serializeenriched.result` from consideration entirely, removed the generic suffix-matching loop and the `REPLY_KEYS` fallback, and removed the raw streamed-text fallback in `parseWorkflowResponse` (stream chunks are now only scanned for whitelisted fields, newest first). Added exported `looksLikeInternalPayload` used by the API route as defense in depth. `SELECTED_OUTPUTS`, `getWorkflowConfig`, and `redactPhones` are unchanged.

- **app/api/chat/route.ts** — Added a single defense-in-depth check right before the reply is returned: if the extracted reply parses as JSON or contains internal markers (`"candidates":`, `"conversation_id":`, `"enrich_status":`, `"selected_ids":`), it is treated as a null reply and `FRIENDLY_FAILURE` is shown, with a comment explaining why. Rate limiter, credentials handling, logging, and all other logic are byte-identical.

- **components/ChatClient.tsx** — Tightened `pickNumbers` to require a second independent signal (mentions of company/title, or phrases like "reply with the number" / "which one") before showing quick-pick buttons. Added role labels (You / Prospect Lens) with avatar dots, relative timestamps refreshed every 30s, a `bubble-welcome` class for the getting-started panel, and an `isNotice` flag so fallback replies get distinct warning styling.

- **components/Markdown.tsx** — Tightened `looksLikeCsv` with a column-count consistency check: every line must have the same (≥1) number of commas as the first line before the CSV copy/download block renders. Everything else unchanged.

- **lib/types.ts** — Added optional `isNotice?: boolean` to `UiMessage` (additive only).

- **app/chat-polish.css** (new) + **app/layout.tsx** (one import line) — New stylesheet for the polish items: message meta rows, fade/slide-in entrance animation (with prefers-reduced-motion guard), amber-tinted notice bubbles, welcome panel glow, scrollable tables, and the ~375px mobile pass (scrollable chips/quick-picks, non-overflowing composer). Existing globals.css and the dark/particle theme are untouched.

- **prisma/schema.prisma** — Returned per the database rule; `ChatMessage` columns preserved exactly (no drops, renames, or type changes).
