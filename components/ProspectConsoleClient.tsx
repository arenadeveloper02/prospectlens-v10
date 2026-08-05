"use client"

import { useCallback, useState } from 'react';
import type { ProspectContact, ProspectStatus } from '@/lib/types';

/** First letters of the first + last name, e.g. "Dharmesh Shah" → "DS". */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts.length > 0 ? (parts[0] ?? '').charAt(0) : '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '').charAt(0) : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || '?';
}

function toStatus(value: unknown): ProspectStatus {
  return value === 'enriched' || value === 'no_email' ? value : 'identified';
}

/** Defensively narrows the identify route's contacts payload into typed contacts. */
function toContacts(value: unknown): ProspectContact[] {
  if (!Array.isArray(value)) return [];
  const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const out: ProspectContact[] = [];
  value.forEach((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const rec = item as Record<string, unknown>;
    const name = s(rec.full_name);
    if (!name) return;
    const id =
      typeof rec.id === 'number' && Number.isFinite(rec.id) && rec.id >= 1
        ? Math.floor(rec.id)
        : i + 1;
    const confidence =
      typeof rec.confidence === 'number' && Number.isFinite(rec.confidence)
        ? `${Math.round(rec.confidence <= 1 ? rec.confidence * 100 : rec.confidence)}%`
        : s(rec.confidence);
    const email = s(rec.work_email);
    out.push({
      id,
      full_name: name,
      title: s(rec.title),
      // company_name is the primary field the routes send — keep a defensive
      // fallback to `company` but never rely on it.
      company_name: s(rec.company_name) || s(rec.company),
      location: s(rec.location),
      seniority: s(rec.seniority),
      confidence,
      linkedin_url: s(rec.linkedin_url),
      photo_url: s(rec.photo_url),
      work_email: email.includes('@') ? email : '',
      status: toStatus(rec.status),
    });
  });
  return out;
}

const CSV_COLUMNS = [
  'full_name',
  'title',
  'company_name',
  'location',
  'seniority',
  'work_email',
  'status',
  'linkedin_url',
] as const;

function buildCsv(contacts: ProspectContact[]): string {
  const esc = (v: string): string => `"${v.replace(/"/g, '""')}"`;
  const header = CSV_COLUMNS.map((c) => esc(c)).join(',');
  const rows = contacts.map((c) => CSV_COLUMNS.map((k) => esc(String(c[k]))).join(','));
  return [header, ...rows].join('\n');
}

interface ContactAvatarProps {
  name: string;
  photoUrl: string;
}

/** Avatar with initials fallback — never shows a broken image icon. */
function ContactAvatar({ name, photoUrl }: ContactAvatarProps) {
  const [broken, setBroken] = useState(false);
  if (!photoUrl || broken) {
    return (
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1A73E8] to-[#00A7D6] text-sm font-semibold text-white shadow-[0_0_16px_rgba(26,115,232,0.4)]"
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <img
      className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-1 ring-white/20"
      src={photoUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };
  return (
    <button
      type="button"
      className="rounded-md border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-100 transition hover:bg-white/20"
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      aria-label={`Copy ${email}`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function ProspectConsoleClient() {
  const [query, setQuery] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [contacts, setContacts] = useState<ProspectContact[]>([]);
  const [reply, setReply] = useState('');
  const [searching, setSearching] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  const busy = searching || enrichingIds.length > 0;

  /**
   * Identify contract: POST /api/identify with { query } (+ conversationId on
   * follow-up turns). The route returns { conversationId, contacts, message }
   * — no reply/company/mode/counts fields exist and are never read.
   */
  const runIdentify = useCallback(async () => {
    const q = query.trim();
    if (!q || busy) return;
    setSearching(true);
    setSelected([]);
    try {
      const body: { query: string; conversationId?: string } = { query: q };
      if (conversationId) body.conversationId = conversationId;
      const response = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as {
        conversationId?: unknown;
        contacts?: unknown;
        message?: unknown;
      } | null;

      if (!response.ok || !data) {
        setContacts([]);
        setReply(
          data && typeof data.message === 'string' && data.message.trim()
            ? data.message.trim()
            : "The search didn't complete. Please try again in a moment.",
        );
        return;
      }

      // Persist the returned conversationId for every subsequent call.
      if (typeof data.conversationId === 'string' && data.conversationId.trim()) {
        setConversationId(data.conversationId.trim());
      }
      const parsed = toContacts(data.contacts);
      setContacts(parsed);
      const message =
        typeof data.message === 'string' && data.message.trim() ? data.message.trim() : '';
      if (parsed.length === 0) {
        setReply(message || 'No matching contacts were found. Try refining your search.');
      } else {
        setReply(message);
      }
    } catch {
      setContacts([]);
      setReply('I had trouble reaching the search service. Please try again in a moment.');
    } finally {
      setSearching(false);
    }
  }, [query, conversationId, busy]);

  /**
   * Enrich contract: ONE candidate per call. POST /api/enrich with
   * { id, conversationId, full_name, company_name } → { id, work_email,
   * status, message } where status is 'enriched' | 'no_email'. The response
   * is merged onto the matching contact by id — no bulk contacts[] handling.
   */
  const enrich = useCallback(
    async (contact: ProspectContact) => {
      if (!conversationId || contact.status !== 'identified') return;
      if (enrichingIds.includes(contact.id)) return;
      setEnrichingIds((prev) => [...prev, contact.id]);
      try {
        const response = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contact.id,
            conversationId,
            full_name: contact.full_name,
            company_name: contact.company_name,
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          id?: unknown;
          work_email?: unknown;
          status?: unknown;
          message?: unknown;
        } | null;

        if (response.ok && data && typeof data.id === 'number' && Number.isFinite(data.id)) {
          const id = Math.floor(data.id);
          const email =
            typeof data.work_email === 'string' && data.work_email.includes('@')
              ? data.work_email.trim()
              : '';
          const rawStatus = toStatus(data.status);
          const status: ProspectStatus =
            rawStatus === 'identified' ? (email ? 'enriched' : 'no_email') : rawStatus;
          setContacts((prev) =>
            prev.map((c) => (c.id === id ? { ...c, work_email: email, status } : c)),
          );
          setSelected((prev) => prev.filter((x) => x !== id));
          if (typeof data.message === 'string' && data.message.trim()) {
            setReply(data.message.trim());
          }
        } else {
          setReply(
            data && typeof data.message === 'string' && data.message.trim()
              ? data.message.trim()
              : `Enrichment for ${contact.full_name} didn't complete. Please try again.`,
          );
        }
      } catch {
        setReply(`Enrichment for ${contact.full_name} failed to reach the service. Please try again.`);
      } finally {
        setEnrichingIds((prev) => prev.filter((x) => x !== contact.id));
      }
    },
    [conversationId, enrichingIds],
  );

  /** Loops sequentially — one /api/enrich call (one credit) per selected contact. */
  const enrichSelected = useCallback(async () => {
    const targets = contacts.filter((c) => selected.includes(c.id) && c.status === 'identified');
    for (const c of targets) {
      // Sequential on purpose: one request per person, in order.
      // eslint-disable-next-line no-await-in-loop
      await enrich(c);
    }
  }, [contacts, selected, enrich]);

  const exportCsv = useCallback(() => {
    if (contacts.length === 0) return;
    const csv = buildCsv(contacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prospects.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [contacts]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectable = contacts.filter((c) => c.status === 'identified');
  // Counts are computed client-side from contacts — never read from the API.
  const enrichedCount = contacts.filter((c) => c.status === 'enriched').length;
  const noEmailCount = contacts.filter((c) => c.status === 'no_email').length;

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-10">
      <header className="flex items-center gap-3 border-b border-white/10 px-1 pb-4 pt-6">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A73E8] to-[#00A7D6] text-sm font-semibold text-white shadow-[0_0_26px_rgba(26,115,232,0.45)]">
          PL
        </span>
        <span>
          <span className="block text-[17px] font-semibold leading-tight text-white">
            Prospect Lens Console
          </span>
          <span className="block text-xs tracking-wide text-slate-400">
            Find, select, and enrich professional contacts
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-[#3BC884] shadow-[0_0_10px_rgba(59,200,132,0.8)]" />
          Live
        </span>
      </header>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void runIdentify();
        }}
      >
        <input
          className="h-12 flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 text-[14.5px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#1A73E8] focus:shadow-[0_0_0_3px_rgba(26,115,232,0.3)]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Find the CMO of Vercel"
          aria-label="Search query"
        />
        <button
          type="submit"
          className="h-12 rounded-2xl bg-gradient-to-br from-[#1A73E8] to-[#1259b8] px-6 text-[14.5px] font-medium text-white shadow-[0_4px_16px_rgba(26,115,232,0.3)] transition hover:brightness-110 disabled:cursor-default disabled:opacity-40"
          disabled={busy || !query.trim()}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {reply && (
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[14px] leading-relaxed text-slate-100 backdrop-blur">
          {reply}
        </div>
      )}

      {contacts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-300">
            {contacts.length} contact{contacts.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-300">
            {enrichedCount} enriched
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-400">
            {noEmailCount} no email
          </span>
          <button
            type="button"
            className="ml-auto rounded-lg border border-[#00A7D6]/50 bg-[#00A7D6]/15 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-[#00A7D6]/30"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
      )}

      {selectable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>
            {selected.length} of {selectable.length} selected
          </span>
          <button
            type="button"
            className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-white/15 disabled:opacity-40"
            disabled={busy || selected.length === selectable.length}
            onClick={() => setSelected(selectable.map((c) => c.id))}
          >
            Select all
          </button>
          <button
            type="button"
            className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-white/15 disabled:opacity-40"
            disabled={busy || selected.length === 0}
            onClick={() => setSelected([])}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#1A73E8]/70 bg-[#1A73E8]/30 px-3 py-1.5 font-medium text-blue-100 transition hover:bg-[#1A73E8]/50 disabled:opacity-40"
            disabled={busy || selected.length === 0}
            onClick={() => void enrichSelected()}
          >
            {enrichingIds.length > 0 ? 'Enriching…' : `Enrich ${selected.length} selected`}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {contacts.map((c) => {
          const isSelected = selected.includes(c.id);
          const isEnriching = enrichingIds.includes(c.id);
          const enriched = c.status === 'enriched' && Boolean(c.work_email);
          const noEmail = c.status === 'no_email';
          return (
            <div
              key={c.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                enriched
                  ? 'border-emerald-400/40 bg-emerald-400/5'
                  : isSelected
                    ? 'border-[#1A73E8]/70 bg-[#1A73E8]/15'
                    : 'border-[#1A73E8]/30 bg-[#1A73E8]/10 hover:border-[#1A73E8]/60'
              }`}
              onClick={() => {
                if (c.status === 'identified' && !busy) toggle(c.id);
              }}
            >
              <span className="mt-1 flex-shrink-0">
                {c.status === 'identified' ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#1A73E8]"
                    checked={isSelected}
                    disabled={busy}
                    onChange={() => toggle(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${c.full_name}`}
                  />
                ) : (
                  <span className="text-emerald-300" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
              <ContactAvatar name={c.full_name} photoUrl={c.photo_url} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[14.5px] font-semibold text-white">{c.full_name}</span>
                {(c.title || c.company_name) && (
                  <span className="text-[13.5px] text-slate-200">
                    {c.title}
                    {c.title && c.company_name ? ' · ' : ''}
                    {c.company_name}
                  </span>
                )}
                {c.location && <span className="text-xs text-slate-400">{c.location}</span>}
                {(c.seniority || c.confidence) && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {c.seniority && (
                      <span className="rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[11px] text-purple-200">
                        {c.seniority}
                      </span>
                    )}
                    {c.confidence && (
                      <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200">
                        {c.confidence} match
                      </span>
                    )}
                  </span>
                )}
                {enriched && (
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                      Verified
                    </span>
                    <span className="break-all text-[13px] font-medium text-emerald-100">
                      {c.work_email}
                    </span>
                    <CopyEmailButton email={c.work_email} />
                  </span>
                )}
                {noEmail && (
                  <span className="mt-1 w-fit rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                    No email
                  </span>
                )}
              </span>
              <span className="flex flex-shrink-0 flex-col items-end gap-2">
                {c.linkedin_url && (
                  <a
                    className="text-xs font-medium text-blue-300 underline underline-offset-2 hover:text-blue-200"
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${c.full_name} on LinkedIn (opens in a new tab)`}
                  >
                    View LinkedIn
                  </a>
                )}
                {c.status === 'identified' && (
                  <button
                    type="button"
                    className="rounded-lg border border-[#1A73E8]/70 bg-[#1A73E8]/30 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-[#1A73E8]/50 disabled:opacity-40"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void enrich(c);
                    }}
                  >
                    {isEnriching ? 'Enriching…' : 'Get email'}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {contacts.length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Select one or more contacts, then press Enrich to fetch verified emails (Apollo-only —
          never guessed).
        </p>
      )}
    </div>
  );
}
