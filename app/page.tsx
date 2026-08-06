"use client"

import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  ConsoleContact,
  EnrichConsoleResponse,
  IdentifyApiResponse,
  ProspectContact,
} from '@/lib/types';

interface EnrichCounts {
  enriched: number;
  offTarget: number;
  unmatched: number;
}

const QUICK_PREFIXES = ['C-Level of ', 'CEO of ', 'VP of ', 'Managing Director of ', 'Director of '];

const EXAMPLES = ['CEO of Figma', 'C-Level of Notion', 'VP of Marketing at Stripe', 'Director of Sales at Canva'];

const SEARCH_INPUT_ID = 'console-search-input';

function focusSearchInput(caret?: number) {
  const el = document.querySelector<HTMLInputElement>(`#${SEARCH_INPUT_ID}`);
  if (!el) return;
  el.focus();
  if (typeof caret === 'number') {
    requestAnimationFrame(() => el.setSelectionRange(caret, caret));
  }
}

function initials(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
  const combined = (first + last).toUpperCase();
  return combined || '?';
}

function avatarGradient(name?: string): string {
  const s = name || '?';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const h2 = (h + 40) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 52%), hsl(${h2} 72% 42%))`;
}

function Avatar({ c }: { c: ConsoleContact }) {
  const [err, setErr] = useState(false);
  if (c.photo_url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={c.photo_url} alt={c.full_name} onError={() => setErr(true)} />;
  }
  return (
    <div
      className="avatar"
      style={{
        background: avatarGradient(c.full_name),
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        letterSpacing: '0.5px',
      }}
    >
      {initials(c.full_name)}
    </div>
  );
}

function toConsoleContact(p: ProspectContact): ConsoleContact {
  return {
    id: String(p.id),
    full_name: p.full_name,
    title: p.title,
    company_name: p.company_name,
    company_domain: '',
    location: p.location,
    linkedin_url: p.linkedin_url,
    work_email: p.work_email || '',
    email_status: '',
    email_deliverable: null,
    status: p.status,
    photo_url: p.photo_url,
    seniority: p.seniority,
    confidence: p.confidence,
  };
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<ConsoleContact[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [searching, setSearching] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [counts, setCounts] = useState<EnrichCounts>({ enriched: 0, offTarget: 0, unmatched: 0 });

  async function runIdentify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError('');
    setMessage('');
    setContacts([]);
    setCounts({ enriched: 0, offTarget: 0, unmatched: 0 });
    // One conversation id per search session — the workflow stores the
    // identified candidates under this id and the enrich turn reloads them
    // by the SAME id, so it must be reused on every enrich call.
    const convId = `finder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConversationId(convId);
    try {
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, conversationId: convId }),
      });
      const data = (await res.json()) as Partial<IdentifyApiResponse>;
      if (!res.ok) {
        throw new Error(data.message || `Request failed (${res.status})`);
      }
      // Reuse whatever id identify echoes back for every enrich call.
      if (data.conversationId) setConversationId(data.conversationId);
      const list = Array.isArray(data.contacts) ? data.contacts : [];
      setContacts(list.map(toConsoleContact));
      setMessage(data.message || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

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
      const data = (await res.json()) as Partial<EnrichConsoleResponse>;
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      const enriched: ConsoleContact[] = Array.isArray(data.contacts) ? data.contacts : [];
      const byId: Record<string, ConsoleContact> = {};
      for (const item of enriched) if (item.id) byId[item.id] = item;
      setContacts((prev) =>
        prev.map((c) => {
          const hit = byId[c.id];
          if (!hit) return c;
          return {
            ...c,
            work_email: hit.work_email || c.work_email,
            email_status: hit.email_status || c.email_status,
            email_deliverable: hit.email_deliverable ?? c.email_deliverable,
            status: hit.status || c.status,
            company_domain: hit.company_domain || c.company_domain,
          };
        }),
      );
      setCounts({
        enriched: Number(data.enriched || 0),
        offTarget: Number(data.offTarget || 0),
        unmatched: Number(data.unmatched || 0),
      });
      if (data.message) setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed.');
    } finally {
      if (markRow) setRowBusy((p) => ({ ...p, [markRow]: false }));
      else setEnrichingAll(false);
    }
  }

  function exportCsv() {
    const cols = [
      'full_name',
      'title',
      'company',
      'company_domain',
      'work_email',
      'email_status',
      'status',
      'linkedin_url',
      'location',
    ];
    const val = (c: ConsoleContact, k: string): string => {
      if (k === 'company') return c.company_name || '';
      if (k === 'email_status') return c.email_status || (c.work_email ? 'verified' : '');
      const rec = c as unknown as Record<string, unknown>;
      const v = rec[k];
      return v === null || v === undefined ? '' : String(v);
    };
    const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
    const rows = [cols.join(',')].concat(
      contacts.map((c) => cols.map((k) => esc(val(c, k))).join(',')),
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${query.trim() || 'leadership'}-contacts.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingIds = contacts.filter((c) => !c.work_email).map((c) => c.id);
  const hasResults = contacts.length > 0;

  return (
    <div className="app" style={{ height: 'auto', minHeight: '100dvh' }}>
      <div className="glow glow-blue" />
      <div className="glow glow-purple" />
      <div className="glow glow-teal" />

      <header className="app-header">
        <div className="brand-mark">PL</div>
        <div>
          <div className="brand-title">Prospect Lens Console</div>
          <div className="brand-sub">Identify leadership contacts, then enrich verified emails</div>
        </div>
        <div className="header-status">
          <span className="status-dot" />
          Online
        </div>
      </header>

      <form className="composer" style={{ paddingTop: 16 }} onSubmit={runIdentify}>
        <input
          id={SEARCH_INPUT_ID}
          aria-label="Search for a role and company"
          className="composer-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "Head of Marketing at Stripe" or "VP Engineering at fintech startups in NYC"'
          disabled={searching}
        />
        <button className="send-btn" type="submit" disabled={searching || !query.trim()}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="quick-inserts">
        {QUICK_PREFIXES.map((p) => (
          <button
            key={p}
            type="button"
            className="qi-chip"
            onClick={() => {
              setQuery(p);
              focusSearchInput(p.length);
            }}
          >
            {p.trim()}
          </button>
        ))}
      </div>

      {!hasResults && !message && !searching ? (
        <div className="welcome">
          <div className="welcome-title">👋 Welcome to Leadership Finder</div>
          <p>
            Find any company&apos;s decision-makers in seconds, then unlock verified work emails
            only for the people you choose — no wasted credits.
          </p>
          <ol className="welcome-steps">
            <li>
              <b>Search</b> a role + company (or tap a quick-insert above).
            </li>
            <li>
              <b>Review</b> the leadership cards we surface.
            </li>
            <li>
              <b>Enrich</b> the ones you want to get a verified email.
            </li>
          </ol>
          <div className="quick-inserts" style={{ margin: '12px 0 0' }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="qi-chip"
                onClick={() => {
                  setQuery(ex);
                  focusSearchInput(ex.length);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            margin: '0 4px 12px',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(220, 38, 38, 0.30)',
            background: 'rgba(254, 226, 226, 0.60)',
            color: '#b91c1c',
            fontSize: 13.5,
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            margin: '0 4px 12px',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(15, 23, 42, 0.08)',
            background: '#ffffff',
            color: 'rgba(15, 23, 42, 0.62)',
            fontSize: 13.5,
          }}
        >
          {message}
        </div>
      ) : null}

      {searching ? (
        <div className="typing" style={{ margin: '0 4px 12px' }}>
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="typing-text">Searching for contacts — deep searches can take a few minutes…</span>
        </div>
      ) : null}

      {hasResults ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            padding: '4px 4px 12px',
          }}
        >
          <span className="pick-label">
            {contacts.length} contact{contacts.length === 1 ? '' : 's'}
            {counts.enriched > 0 ? ` · ${counts.enriched} enriched` : ''}
            {counts.unmatched > 0 ? ` · ${counts.unmatched} without email` : ''}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="md-btn" onClick={exportCsv}>
              Export CSV
            </button>
            <button
              type="button"
              className="send-btn"
              style={{ height: 34, padding: '0 16px', fontSize: 13 }}
              disabled={enrichingAll || pendingIds.length === 0}
              onClick={() => enrich(pendingIds)}
            >
              {enrichingAll ? 'Enriching…' : `Enrich all (${pendingIds.length})`}
            </button>
          </div>
        </div>
      ) : null}

      {hasResults ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 4px 28px' }}>
          {contacts.map((c) => {
            const busy = Boolean(rowBusy[c.id]);
            const enrichedRow = Boolean(c.work_email);
            const noEmail =
              !c.work_email && (c.status === 'no_email' || c.status === 'no_email_found');
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                }}
              >
                <Avatar c={c} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: '#0F172A' }}>
                    {c.full_name}
                  </span>
                  {c.title || c.company_name ? (
                    <span style={{ fontSize: 13, color: 'rgba(15, 23, 42, 0.62)' }}>
                      {c.title}
                      {c.title && c.company_name ? ' · ' : ''}
                      {c.company_name}
                    </span>
                  ) : null}
                  {c.location ? (
                    <span style={{ fontSize: 12, color: 'rgba(15, 23, 42, 0.40)' }}>{c.location}</span>
                  ) : null}
                  {c.seniority || c.confidence ? (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      {c.seniority ? (
                        <span
                          style={{
                            padding: '1px 8px',
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 500,
                            border: '1px solid rgba(179, 100, 215, 0.40)',
                            background: 'rgba(179, 100, 215, 0.10)',
                            color: '#7e3ba3',
                          }}
                        >
                          {c.seniority}
                        </span>
                      ) : null}
                      {c.confidence ? (
                        <span
                          style={{
                            padding: '1px 8px',
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 500,
                            border: '1px solid rgba(22, 163, 74, 0.35)',
                            background: 'rgba(22, 163, 74, 0.10)',
                            color: '#166534',
                          }}
                        >
                          {c.confidence} match
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {c.work_email ? (
                    <span
                      style={{
                        marginTop: 4,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: '#166534',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {c.work_email}
                      {c.email_status ? ` · ${c.email_status}` : ''}
                    </span>
                  ) : noEmail ? (
                    <span style={{ marginTop: 4, fontSize: 12, fontStyle: 'italic', color: '#b45309' }}>
                      No email found
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  {c.linkedin_url ? (
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        background: 'linear-gradient(135deg, #7C6CFF, #4DB8FF)',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 500,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(124, 108, 255, 0.25)',
                      }}
                    >
                      LinkedIn
                    </a>
                  ) : null}
                  {!enrichedRow ? (
                    <button
                      type="button"
                      disabled={busy || enrichingAll}
                      onClick={() => enrich([c.id], c.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(124, 108, 255, 0.45)',
                        background: 'rgba(124, 108, 255, 0.08)',
                        color: '#5b4fd6',
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        cursor: busy || enrichingAll ? 'default' : 'pointer',
                        opacity: busy ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {busy ? 'Enriching…' : 'Enrich'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
