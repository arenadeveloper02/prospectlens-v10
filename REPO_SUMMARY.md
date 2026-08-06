# Repository Summary: prospectlens-v10

> Auto-maintained by Sim Development. Last updated: 2026-08-06T10:34:49.823Z.

## Overview

Prospect Lens console — identify leadership contacts via the Prospect Lens workflow, enrich verified emails onto the same cards, and export CSV. Fix: added the ChatMessage Prisma model that app/api/chat/route.ts logs to (prisma.chatMessage), resolving TS2339 on the PrismaClient. AppSetting is preserved byte-for-byte; the new model is purely additive so prisma db push succeeds without data loss.

**Repository:** `prospectlens-v10`  
**File count:** 40

## Features

- Search → enrich flow reusing one conversationId per session
- Bare-picks enrichment contract ("1" or "1, 3") against the workflow Selection Gate
- Verified emails read from selected_details_json[].work_email
- CSV export with resolved company + email_status columns
- Best-effort chat message logging to Postgres (ChatMessage model)
- Arena email gate with access-denied page and iframe-safe headers

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

- **Updated at:** 2026-08-06T10:34:49.823Z
- **Request:** The Prospect Lens workflow is correct and verified. The app fails to (a) reuse the same conversationId across search→enrich, and (b) send a bare pick. Fix exactly these three files. Do not touch any styling, layout, cards, or buttons — only the data wiring below.

1. app/page.tsx
a. Add conversation state (top of Page, with the other useStates):

ts

const [conversationId, setConversationId] = useState('');
b. In runIdentify, mint one id per search, send it, and store what identify echoes back. In the fetch('/api/identify') body add conversationId, and after parsing data:

ts

const convId = `finder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
setConversationId(convId);
// ...inside the JSON.stringify body, add: conversationId: convId,
// ...after `const data = await res.json();` and the error check:
if (data.conversationId) setConversationId(data.conversationId);
c. Rewrite enrich() to send bare picks (1-based positions) + the same conversationId:

ts

async function enrich(ids: string[], markRow?: string) {
 if (ids.length === 0) return;
 if (markRow) setRowBusy((p) => ({ ...p, [markRow]: true }));
 else setEnrichingAll(true);
 setError('');
 try {
 // The workflow's Selection Gate wants bare picks: "1" or "1, 3".
 // Map selected contact ids -> their 1-based card position.
 const picks = ids
 .map((id) => contacts.findIndex((c) => c.id === id))
 .filter((i) => i >= 0)
 .map((i) => i + 1);
 const res = await fetch('/api/enrich', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ picks, conversationId }),
 });
 const data = await res.json();
 if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
 const enriched: Contact[] = Array.isArray(data.contacts) ? data.contacts : [];
 const byId: Record<string, Contact> = {};
 for (const e of enriched) if (e.id) byId[e.id] = e;
 setContacts((prev) => prev.map((c) => (byId[c.id] ? { ...c, ...byId[c.id] } : c)));
 setCounts({
 enriched: Number(data.enriched || 0),
 offTarget: Number(data.offTarget || 0),
 unmatched: Number(data.unmatched || 0),
 });
 } catch (e: any) {
 setError(e?.message || 'Enrichment failed.');
 } finally {
 if (markRow) setRowBusy((p) => ({ ...p, [markRow]: false }));
 else setEnrichingAll(false);
 }
}
d. CSV export — resolve company + email_status so enriched rows aren't blank (keep the button exactly where it is):

ts

function exportCsv() {
 const cols = ['full_name','title','company','company_domain','work_email','email_status','status','linkedin_url','location'];
 const val = (c: any, k: string) => {
 if (k === 'company') return c.company || c.company_name || '';
 if (k === 'email_status') return c.email_status || (c.work_email ? 'verified' : '');
 return c[k] ?? '';
 };
 const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
 const rows = [cols.join(',')].concat(contacts.map((c) => cols.map((k) => esc(val(c, k))).join(',')));
 const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${company?.name || query || 'leadership'}-contacts.csv`;
 a.click();
 URL.revokeObjectURL(url);
}
2. app/api/enrich/route.ts — accept picks[], send a bare pick, return contacts[]
Replace the whole POST handler and swap extractEnriched for a details extractor:

ts

export async function POST(req: Request) {
 try {
 const body = await req.json().catch(() => ({}))
 const conversationId: string = body.conversationId || ''
 // 1-based positions from the UI; fall back to a single id if that's all we got.
 const picks: number[] = Array.isArray(body.picks)
 ? body.picks.map((n: any) => Number(n)).filter((n: number) => n > 0)
 : body.id != null ? [Number(body.id)] : []

 if (picks.length === 0) {
 return NextResponse.json({ error: 'Missing picks to enrich' }, { status: 400 })
 }
 if (!conversationId) {
 return NextResponse.json(
 { error: 'Missing conversationId — enrich must reuse the id from the search call.' },
 { status: 400 },
 )
 }

 // The Selection Gate expects a BARE pick string: "1" or "1, 3".
 const input = picks.join(', ')

 const res = await fetch(PROSPECT_LENS_URL, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'x-api-key': PROSPECT_LENS_API_KEY },
 body: JSON.stringify({ input, conversationId }),
 })

 if (!res.ok) {
 const text = await res.text().catch(() => '')
 return NextResponse.json(
 { error: `Prospect Lens error (${res.status})`, detail: text.slice(0, 500) },
 { status: 502 },
 )
 }

 const data = await res.json().catch(() => ({}))
 const people = extractDetails(data) // selected_details_json[] — authoritative

 const contacts = people.map((p: any) => {
 const email = p.work_email ?? p.email ?? p.personal_email ?? ''
 return {
 id: String(p.id ?? p.candidate_id ?? ''),
 full_name: p.name ?? p.full_name ?? '',
 title: p.title ?? '',
 company_name: p.company ?? p.company_name ?? '',
 company_domain: p.company_domain ?? p.domain ?? '',
 location: p.location ?? '',
 linkedin_url: p.linkedin_url ?? '',
 work_email: email,
 email_status: email ? (p.email_type === 'personal' ? 'personal' : 'verified') : '',
 email_deliverable: email ? true : null,
 status: email ? 'enriched' : 'no_email_found',
 }
 })

 const enriched = contacts.filter((c) => c.work_email).length
 return NextResponse.json({
 contacts,
 enriched,
 offTarget: 0,
 unmatched: contacts.length - enriched,
 message: data.message ?? data.output?.message ?? '',
 })
 } catch (err: any) {
 return NextResponse.json({ error: 'enrich failed', detail: String(err?.message ?? err) }, { status: 500 })
 }
}
Add this helper (replace extractEnriched) — it walks any wrapper and returns the workflow's selected_details_json array:

ts

function extractDetails(payload: any): any[] {
 if (!payload) return []
 const seen = new Set<any>()
 const stack = [payload]
 while (stack.length) {
 const node = stack.pop()
 if (!node || typeof node !== 'object' || seen.has(node)) continue
 seen.add(node)
 if (Array.isArray(node.selected_details_json)) return node.selected_details_json
 if (typeof node.selected_details_json === 'string') {
 try { const a = JSON.parse(node.selected_details_json); if (Array.isArray(a)) return a } catch {}
 }
 if (Array.isArray(node.results)) return node.results
 for (const k of Object.keys(node)) { const v = node[k]; if (v && typeof v === 'object') stack.push(v) }
 }
 return []
}
3. app/api/identify/route.ts — one line
It already forwards conversationId. Just make sure it uses the client's value when present (it does). No other change needed.

Contract (must hold, or email stays blank)
One conversationId per search, reused on every enrich in that session.
Enrich sends bare picks ("1" or "1, 3") as input — never a sentence, never selectedId.
Read emails from selected_details_json[].work_email; status === 'enriched' = success.
