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

      {error ? (
        <div
          style={{
            margin: '0 4px 12px',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(243, 26, 26, 0.45)',
            background: 'rgba(243, 26, 26, 0.12)',
            color: '#ffb9b9',
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
            border: '1px solid rgba(255, 255, 255, 0.14)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#cdd5e6',
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

      {contacts.length > 0 ? (
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
              className="md-btn md-btn-primary"
              onClick={() => enrich(pendingIds)}
              disabled={enrichingAll || pendingIds.length === 0}
            >
              {enrichingAll ? 'Enriching…' : `Enrich All (${pendingIds.length})`}
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px 32px' }}>
        {contacts.map((c, i) => (
          <div key={c.id} className="md-card">
            <div className="md-card-num">{i + 1}</div>
            <div className="md-card-body" style={{ flex: 1 }}>
              <p className="md-card-line">
                {c.full_name}
                {c.seniority ? ` · ${c.seniority}` : ''}
                {c.confidence ? ` · ${c.confidence}` : ''}
              </p>
              <p className="md-card-line">{[c.title, c.company_name].filter(Boolean).join(' — ')}</p>
              {c.location ? <p className="md-card-line">{c.location}</p> : null}
              {c.linkedin_url ? (
                <a
                  className="md-link"
                  style={{ fontSize: 13 }}
                  href={c.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn profile
                </a>
              ) : null}
              {c.work_email ? (
                <p className="md-card-line" style={{ color: '#89deb5' }}>
                  ✉ {c.work_email}
                  {c.email_status ? ` (${c.email_status})` : ''}
                </p>
              ) : c.status === 'no_email_found' || c.status === 'no_email' ? (
                <p className="md-card-line" style={{ color: '#f0a878' }}>
                  No verified email found
                </p>
              ) : null}
            </div>
            {!c.work_email ? (
              <button
                type="button"
                className="md-btn md-btn-primary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => enrich([c.id], c.id)}
                disabled={Boolean(rowBusy[c.id]) || enrichingAll}
              >
                {rowBusy[c.id] ? 'Enriching…' : 'Enrich'}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {contacts.length === 0 && !searching ? (
        <div style={{ padding: '24px 4px', color: '#a3adc4', fontSize: 13.5 }}>
          Run a search to identify contacts — e.g. &quot;VP Engineering at fintech startups in NYC&quot;.
          Then enrich the cards you want verified emails for.
        </div>
      ) : null}
    </div>
  );
}
