"use client"

import { useCallback, useEffect, useState } from 'react';
import type {
  ConsoleContact,
  EnrichConsoleResponse,
  HistoryApiResponse,
  ProspectContact,
} from '@/lib/types';

/** One history session as the panel holds it (contacts in console shape). */
interface PanelSession {
  rowId: string;
  conversationId: string;
  message: string;
  updatedAt: string;
  contacts: ConsoleContact[];
}

function isEnrichedContact(c: { status?: string }): boolean {
  return (c.status || '').toLowerCase().includes('enriched');
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
    email_status: p.work_email ? 'verified' : '',
    email_deliverable: null,
    status: p.status,
    photo_url: p.photo_url,
    seniority: p.seniority,
    confidence: p.confidence,
  };
}

function formatWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function sessionTitle(s: PanelSession): string {
  const companies = [...new Set(s.contacts.map((c) => c.company_name).filter(Boolean))];
  if (companies.length === 1) return companies[0];
  if (companies.length > 1) return companies.slice(0, 2).join(', ');
  const msg = s.message.trim().split('\n')[0] || '';
  if (msg) return msg.length > 72 ? `${msg.slice(0, 69)}…` : msg;
  return 'Search session';
}

function sessionBadge(s: PanelSession): string {
  const n = s.contacts.length;
  if (n === 0) return 'Search';
  return `${n} contact${n === 1 ? '' : 's'}`;
}

function sessionCategory(s: PanelSession): string {
  const companies = [...new Set(s.contacts.map((c) => c.company_name).filter(Boolean))];
  // Avoid repeating the same company name already shown as the row title.
  if (companies.length === 1) return '';
  if (s.contacts.some((c) => c.work_email)) return 'Enriched';
  return 'Leadership';
}

const CSV_COLS = [
  'full_name',
  'title',
  'company',
  'company_domain',
  'work_email',
  'email_status',
  'status',
  'linkedin_url',
  'location',
] as const;

/** Same CSV shape as the console page's Export CSV. */
function buildCsv(contacts: ConsoleContact[]): string {
  const val = (c: ConsoleContact, k: string): string => {
    if (k === 'company') return c.company_name || '';
    if (k === 'email_status') return c.email_status || (c.work_email ? 'verified' : '');
    const rec = c as unknown as Record<string, unknown>;
    const v = rec[k];
    return v === null || v === undefined ? '' : String(v);
  };
  const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  const rows = [CSV_COLS.join(',')].concat(
    contacts.map((c) => CSV_COLS.map((k) => esc(val(c, k))).join(',')),
  );
  return rows.join('\n');
}

/**
 * Right-side history panel. Sessions come from GET /api/history (the
 * chat-history workflow keyed on the Arena session email). Each session
 * supports the SAME functionality as the console: select contacts and enrich
 * them via /api/enrich (reusing the session's stored conversation_id, bare
 * picks contract), and export the session's contacts as CSV.
 */
export function HistoryPanel() {
  const [sessions, setSessions] = useState<PanelSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openId, setOpenId] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as Partial<HistoryApiResponse> | null;
      if (!res.ok || !data) {
        throw new Error(data?.message || `History failed (${res.status})`);
      }
      const list = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(
        list.map((s) => ({
          rowId: s.rowId,
          conversationId: s.conversationId,
          message: s.message,
          updatedAt: s.updatedAt,
          contacts: (s.contacts || []).map(toConsoleContact),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (rowId: string, contactId: string, contact: ConsoleContact) => {
    if (isEnrichedContact(contact)) return;
    setSelected((prev) => {
      const cur = prev[rowId] ?? [];
      return {
        ...prev,
        [rowId]: cur.includes(contactId)
          ? cur.filter((x) => x !== contactId)
          : [...cur, contactId],
      };
    });
  };

  const enrichSession = useCallback(
    async (s: PanelSession) => {
      const picked = selected[s.rowId] ?? [];
      if (picked.length === 0 || busyId || !s.conversationId) return;
      // The workflow's Selection Gate wants bare picks: "1" or "1, 3".
      // Map selected contact ids -> their 1-based card position — the SAME
      // contract the console page uses.
      const picks = picked
        .map((id) => s.contacts.findIndex((c) => c.id === id && !isEnrichedContact(c)))
        .filter((i) => i >= 0)
        .map((i) => i + 1)
        .sort((a, b) => a - b);
      if (picks.length === 0) return;
      setBusyId(s.rowId);
      setError('');
      setNotice('');
      try {
        const res = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ picks, conversationId: s.conversationId }),
        });
        const data = (await res.json().catch(() => null)) as Partial<EnrichConsoleResponse> | null;
        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || data?.message || `Enrichment failed (${res.status})`);
        }
        const enriched: ConsoleContact[] = Array.isArray(data.contacts) ? data.contacts : [];
        const byId: Record<string, ConsoleContact> = {};
        for (const item of enriched) if (item.id) byId[item.id] = item;
        setSessions((prev) =>
          prev.map((sess) => {
            if (sess.rowId !== s.rowId) return sess;
            return {
              ...sess,
              contacts: sess.contacts.map((c) => {
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
            };
          }),
        );
        setSelected((prev) => ({ ...prev, [s.rowId]: [] }));
        if (data.message) setNotice(data.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enrichment failed.');
      } finally {
        setBusyId('');
      }
    },
    [selected, busyId],
  );

  const exportCsv = (s: PanelSession) => {
    if (s.contacts.length === 0) return;
    const blob = new Blob([buildCsv(s.contacts)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-${s.conversationId || s.rowId}-contacts.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="history-panel agent-card" aria-label="Search history">
      <div className="hist-head agent-card-head">
        <span className="agent-kicker">Previous runs</span>
        <button
          type="button"
          className="hist-refresh agent-ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="hist-error">{error}</div> : null}
      {notice ? <div className="hist-notice">{notice}</div> : null}

      {!loading && sessions.length === 0 && !error ? (
        <div className="hist-empty">No history yet — run a search and it will appear here.</div>
      ) : null}

      <div className="hist-list">
        {sessions.map((s) => {
          const open = openId === s.rowId;
          const picked = selected[s.rowId] ?? [];
          const busy = busyId === s.rowId;
          const selectable = s.contacts.filter((c) => !isEnrichedContact(c));
          return (
            <div key={s.rowId} className={`hist-card${open ? ' hist-card-open' : ''}`}>
              <div className="hist-row">
                <div className="hist-row-main">
                  <div className="hist-row-title">{sessionTitle(s)}</div>
                  <div className="hist-row-meta">
                    <span className="agent-pill">{sessionBadge(s)}</span>
                    {formatWhen(s.updatedAt) ? (
                      <span className="agent-date">{formatWhen(s.updatedAt)}</span>
                    ) : null}
                    {sessionCategory(s) ? (
                      <span className="agent-cat">{sessionCategory(s)}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="agent-ghost"
                  onClick={() => setOpenId(open ? '' : s.rowId)}
                  aria-expanded={open}
                >
                  {open ? 'Hide' : 'View'}
                </button>
              </div>

              {open && s.contacts.length > 0 ? (
                <div className="hist-contacts">
                  {s.contacts.map((c) => {
                    const enriched = isEnrichedContact(c);
                    return (
                    <label
                      key={c.id}
                      className={`hist-contact${enriched ? ' hist-contact-locked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="hist-checkbox"
                        checked={enriched || picked.includes(c.id)}
                        disabled={busy || enriched}
                        onChange={() => toggle(s.rowId, c.id, c)}
                        aria-label={
                          enriched
                            ? `${c.full_name} already enriched`
                            : `Select ${c.full_name}`
                        }
                      />
                      <span className="hist-contact-main">
                        <span className="hist-contact-name">{c.full_name}</span>
                        {(c.title || c.company_name) && (
                          <span className="hist-contact-line">
                            {c.title}
                            {c.title && c.company_name ? ' · ' : ''}
                            {c.company_name}
                          </span>
                        )}
                        {c.work_email ? (
                          <span className="hist-email">{c.work_email}</span>
                        ) : c.status === 'no_email' || c.status === 'no_email_found' ? (
                          <span className="hist-noemail">No email available</span>
                        ) : null}
                      </span>
                    </label>
                    );
                  })}
                </div>
              ) : null}

              {open && s.contacts.length > 0 ? (
                <div className="hist-actions">
                  <button
                    type="button"
                    className="hist-btn hist-btn-primary"
                    disabled={
                      busy || picked.length === 0 || !s.conversationId || selectable.length === 0
                    }
                    onClick={() => void enrichSession(s)}
                  >
                    {busy
                      ? 'Enriching…'
                      : picked.length > 0
                        ? `Enrich ${picked.length} selected`
                        : 'Enrich selected'}
                  </button>
                  <button type="button" className="hist-btn" onClick={() => exportCsv(s)}>
                    Export CSV
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
