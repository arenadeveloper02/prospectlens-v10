# Change Summary — new workflow endpoint + structured response contract

No auth, rate-limiting, middleware, UI, or database-schema behavior changed. The Prisma schema is returned unchanged (ChatMessage columns preserved exactly; no drops, renames, or type changes).

## Files changed and why

- **lib/prospectlens.ts** — Switched `DEFAULT_API_URL` to the new workflow (`93554407-b92d-4ec6-ba3c-be07be4c153b/execute`) and `DEFAULT_API_KEY` to the new key; both remain overridable via `PROSPECTLENS_API_URL` / `PROSPECTLENS_API_KEY`. Replaced the old per-block output whitelist (`presentcards.content`, etc.) with the new structured contract: the extractor now looks for `{ reply, mode, cardCount }` — an object's own `reply` field first, then the `result` / `output` / `content` / `data` containers, then plain-string `output`/`content` fallbacks (rejected if they look like internal payloads). `parseWorkflowResponse` now parses the plain JSON body directly and keeps an SSE `data:` fallback for streamed deployments. Removed the now-unused `SELECTED_OUTPUTS` export. `looksLikeInternalPayload` and `redactPhones` are unchanged.

- **app/api/chat/route.ts** — Request body is now exactly `{ input: message, conversationId }` per the new contract (no `stream`, no `selectedOutputs`); dropped the `SELECTED_OUTPUTS` import accordingly. Timeout tightened to 120s to match the workflow contract. Everything else (validation, rate limiter, best-effort Prisma logging, defense-in-depth reply check, friendly failure copy) is unchanged.

- **.env.example** — Documents `DATABASE_URL`, the new `PROSPECTLENS_API_URL` / `PROSPECTLENS_API_KEY` values, and `PORT=3000`.

- **prisma/schema.prisma** — Returned per the database rule; `ChatMessage` columns preserved exactly.
