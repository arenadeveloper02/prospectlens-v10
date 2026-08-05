"use client"

import { useCallback, useState } from 'react';
import type { EnrichedPerson, ProspectContact, ProspectStatus } from '@/lib/types';

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

/** Defensively narrows the enrich route's results payload into typed people. */
function toEnrichedList(value: unknown): EnrichedPerson[] {
  if (!Array.isArray(value)) return [];
  const out: EnrichedPerson[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id =
      typeof rec.id === 'number' && Number.isFinite(rec.id) && rec.id >= 1
        ? Math.floor(rec.id)
        : 0;
    const name = typeof rec.full_name === 'string' ? rec.full_name.trim() : '';
    const emailRaw = typeof rec.work_email === 'string' ? rec.work_email.trim() : '';
    const email = emailRaw.includes('@') ? emailRaw : '';
    const status: 'enriched' | 'no_email' =
      rec.status === 'enriched' || rec.status === 'no_email'
        ? rec.status
        : email
          ? 'enriched'
          : 'no_email';
    out.push({ id, full_name: name, work_email: email, status });
  }
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
   * Identify contract: POST /api/identify with { query }. The route calls the
   * workflow with { inputs: { input, conversationId } }, generating a fresh
   * conversationId (uuid) and returning { conversationId, contacts, message }.
   * That conversationId is persisted in state — enrich MUST reuse it verbatim
   * or the workflow won't find its stored candidates.
   */
  const runIdentify = useCallback(async () => {
    const q = query.trim();
    if (!q || busy) return;
    setSearching(true);
    setSelected([]);
    try {
      const response = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = (await response.json().catch(() => null)) as {
        conversationId?: unknown;
        contacts?: unknown;
        message?: unknown;
      } | null;

      const message =
        data && typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : '';

      if (!response.ok || !data) {
        setContacts([]);
        // Surface the actual status/message so failures are debuggable.
        setReply(message || `The search failed (HTTP ${response.status}). Please try again.`);
        return;
      }

      // Persist the returned conversationId for every subsequent enrich call.
      if (typeof data.conversationId === 'string' && data.conversationId.trim()) {
        setConversationId(data.conversationId.trim());
      }
      const parsed = toContacts(data.contacts);
      setContacts(parsed);
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
  }, [query, busy]);

  /**
   * Enrich contract: selecting cards IS the input. The displayed card numbers
   * of every selected contact are joined with ", " and sent as `selection`
   * along with the SAME conversationId returned by identify. The route
   * forwards { inputs: { input: selection, conversationId } } and returns
   * { results: [{ id, full_name, work_email, status }], message }.
   */
  const enrichSelected = useCallback(async () => {
    if (!conversationId || busy) return;
    const ids = contacts
      .filter((c) => selected.includes(c.id) && c.status === 'identified')
      .map((c) => c.id)
      .sort((a, b) => a - b);
    if (ids.length === 0) return;
    const selection = ids.join(', ');
    setEnrichingIds(ids);
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection, conversationId }),
      });
      const data = (await response.json().catch(() => null)) as {
        results?: unknown;
        message?: unknown;
      } | null;

      const message =
        data && typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : '';
      const results = toEnrichedList(data?.results);

      if (!response.ok) {
        setReply(message || `Enrichment failed (HTTP ${response.status}). Please try again.`);
        return;
      }
      if (results.length === 0) {
        setReply(
          message || `Enrichment returned no details (HTTP ${response.status}). Please try again.`,
        );
        return;
      }

      // Merge results back onto the SAME contacts by id (name fallback).
      setContacts((prev) =>
        prev.map((c) => {
          const hit =
            results.find((r) => r.id === c.id) ??
            results.find(
              (r) => r.full_name && r.full_name.toLowerCase() === c.full_name.toLowerCase(),
            );
          if (hit && ids.includes(c.id)) {
            return { ...c, work_email: hit.work_email, status: hit.status };
          }
          // Requested but not returned → no verified email was found for it.
          if (ids.includes(c.id) && c.status === 'identified') {
            return { ...c, status: 'no_email' as ProspectStatus };
          }
          return c;
        }),
      );
      setSelected([]);
      if (message) setReply(message);
    } catch {
      setReply('I could not reach the enrichment service. Please try again in a moment.');
    } finally {
      setEnrichingIds([]);
    }
  }, [contacts, selected, conversationId, busy]);

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
          className="h-12 rounded-2xl bg-gradient-to-r from-[#1A73E8] to-[#1259b8] px-6 text-[14.5px] font-medium text-white shadow-[0_4px_16px_rgba(26,115,232,0.3)] transition hover:brightness-110 disabled:cursor-default disabled:opacity-40"
          disabled={busy || !query.trim()}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {reply && (
        <p className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-relaxed text-slate-200">
          {reply}
        </p>
      )}

      {searching && (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A73E8] border-t-transparent" />
          Searching — a deep search can take a little while…
        </div>
      )}

      {!searching && contacts.length === 0 && !reply && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-[15px] font-semibold text-white">Welcome to Prospect Lens</p>
          <p className="mt-2 text-sm text-slate-300">
            Search for a person or role (e.g. “Find the CMO of Vercel”), then click cards to
            select them and press “Enrich selected” to fetch verified work emails.
          </p>
        </div>
      )}

      {contacts.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">
              {contacts.length} contact{contacts.length > 1 ? 's' : ''} · {enrichedCount} enriched ·{' '}
              {noEmailCount} without email
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15 disabled:cursor-default disabled:opacity-40"
                disabled={busy || selectable.length === 0 || selected.length === selectable.length}
                onClick={() => setSelected(selectable.map((c) => c.id))}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15 disabled:cursor-default disabled:opacity-40"
                disabled={busy || selected.length === 0}
                onClick={() => setSelected([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#1A73E8]/70 bg-[#1A73E8]/30 px-4 py-1.5 text-xs font-semibold text-blue-100 transition hover:bg-[#1A73E8]/50 hover:text-white disabled:cursor-default disabled:opacity-40"
                disabled={busy || selected.length === 0}
                onClick={() => void enrichSelected()}
              >
                {enrichingIds.length > 0 ? 'Enriching…' : `Enrich ${selected.length} selected`}
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#00A7D6]/60 bg-[#00A7D6]/20 px-4 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-[#00A7D6]/40 hover:text-white disabled:cursor-default disabled:opacity-40"
                disabled={busy}
                onClick={exportCsv}
              >
                Export CSV
              </button>
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {contacts.map((c) => {
              const isSelected = selected.includes(c.id);
              const isEnriching = enrichingIds.includes(c.id);
              const selectableCard = c.status === 'identified';
              return (
                <div
                  key={c.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-[#1A73E8] bg-[#1A73E8]/20'
                      : 'border-[#1A73E8]/30 bg-[#1A73E8]/10 hover:border-[#1A73E8]/60'
                  }${selectableCard ? ' cursor-pointer' : ''}`}
                  onClick={() => {
                    if (selectableCard && !busy) toggle(c.id);
                  }}
                >
                  <span className="mt-1 flex-shrink-0">
                    {selectableCard ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#1A73E8]"
                        checked={isSelected}
                        disabled={busy}
                        onChange={() => toggle(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select candidate ${c.id}: ${c.full_name}`}
                      />
                    ) : (
                      <span className="text-sm text-emerald-300" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </span>
                  <span
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A73E8] to-[#00A7D6] text-[13px] font-semibold text-white"
                    aria-hidden="true"
                  >
                    {c.id}
                  </span>
                  <ContactAvatar name={c.full_name} photoUrl={c.photo_url} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[14.5px] font-semibold text-white">{c.full_name}</span>
                    {(c.title || c.company_name) && (
                      <span className="text-[13px] text-slate-300">
                        {c.title}
                        {c.title && c.company_name ? ' · ' : ''}
                        {c.company_name}
                      </span>
                    )}
                    {c.location && <span className="text-xs text-slate-400">{c.location}</span>}
                    {(c.seniority || c.confidence) && (
                      <span className="flex flex-wrap gap-1.5">
                        {c.seniority && (
                          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-slate-200">
                            {c.seniority}
                          </span>
                        )}
                        {c.confidence && (
                          <span className="rounded-full border border-[#00A7D6]/50 bg-[#00A7D6]/15 px-2 py-0.5 text-[11px] text-cyan-200">
                            {c.confidence} match
                          </span>
                        )}
                      </span>
                    )}
                    {c.work_email && (
                      <span className="flex items-center gap-2 text-[13px] text-emerald-200">
                        <span className="truncate">{c.work_email}</span>
                        <CopyEmailButton email={c.work_email} />
                      </span>
                    )}
                    {c.status === 'no_email' && (
                      <span className="text-xs text-amber-300">No verified email available</span>
                    )}
                  </span>
                  <span className="ml-auto flex flex-shrink-0 flex-col items-end gap-2">
                    {c.linkedin_url && (
                      <a
                        className="rounded-md border border-[#1A73E8]/60 bg-[#1A73E8]/20 px-2.5 py-1 text-[11px] font-medium text-blue-200 transition hover:bg-[#1A73E8]/40 hover:text-white"
                        href={c.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View ${c.full_name} on LinkedIn (opens in a new tab)`}
                      >
                        LinkedIn
                      </a>
                    )}
                    {isEnriching && (
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A73E8] border-t-transparent"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Click cards to select them, then press “Enrich selected” — the picked card numbers are
            sent to the workflow to fetch verified emails (Apollo-only, never guessed).
          </p>
        </>
      )}
    </div>
  );
}
