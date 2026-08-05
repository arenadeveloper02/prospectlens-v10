"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UiMessage, QuickPhrase, CandidateCard, EnrichmentResult } from '@/lib/types';
import { Markdown } from '@/components/Markdown';
import { TypingIndicator } from '@/components/TypingIndicator';
import { QuickChips } from '@/components/QuickChips';
import { ParticleField } from '@/components/ParticleField';
import { CandidateCards } from '@/components/CandidateCards';

const QUICK_PHRASES: QuickPhrase[] = [
  { label: 'Find the CMO of Vercel', message: 'Find the CMO of Vercel' },
  { label: 'VP of Sales at Notion', message: 'VP of Sales at Notion' },
  { label: 'Head of Marketing at Stripe', message: 'Head of Marketing at Stripe' },
  { label: 'Show all my contacts', message: 'Show all my contacts' },
];

const WELCOME = [
  '**Welcome to Prospect Lens.** I help you find, select, and enrich professional contacts.',
  '',
  'Try something like:',
  '- Find the CMO of Vercel',
  '- VP of Sales at Notion',
  '',
  'When I show candidate cards, select one or more and press "Enrich selected" to fetch verified emails onto the same cards. Say "Show all my contacts" anytime to export everything as a table and CSV.',
].join('\n');

const CONVERSATION_COOKIE = 'pl_conversation_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stable per-browser-session conversation id, generated ONCE and reused for
 * every turn (search → select → enrich → export). The workflow keys saved
 * candidates on this value, so it must never change mid-conversation and is
 * never derived from the user's email.
 */
function getOrCreateConversationId(): string {
  const match = document.cookie.match(/(?:^|;\s*)pl_conversation_id=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  const id = generateId();
  document.cookie = `${CONVERSATION_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=None; Secure`;
  return id;
}

function formatRelativeTime(value: string | Date, now: number): string {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const diff = Math.max(0, now - time);
  if (diff < 45_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(time).toLocaleDateString();
}

/** Matches fallback/notice copy sent by the API route or local error paths. */
function isFallbackReply(text: string): boolean {
  return /try again in a moment|shorten it and try again|catch up, then try again|start searching|was stopped/i.test(
    text,
  );
}

/** Defensively narrows the API's candidates payload into typed cards. */
function toUiCandidates(value: unknown): CandidateCard[] {
  if (!Array.isArray(value)) return [];
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;
  const out: CandidateCard[] = [];
  value.forEach((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== 'string' || !rec.name.trim()) return;
    out.push({
      index:
        typeof rec.index === 'number' && Number.isFinite(rec.index) && rec.index >= 1
          ? Math.floor(rec.index)
          : i + 1,
      id:
        typeof rec.id === 'number' && Number.isFinite(rec.id) && rec.id >= 1
          ? Math.floor(rec.id)
          : undefined,
      name: rec.name.trim(),
      title: typeof rec.title === 'string' ? rec.title : '',
      company: typeof rec.company === 'string' ? rec.company : '',
      linkedin: str(rec.linkedin),
      location: str(rec.location),
      seniority: str(rec.seniority),
      confidence: str(rec.confidence),
      photoUrl: str(rec.photoUrl),
      summary: str(rec.summary),
    });
  });
  return out.slice(0, 10);
}

/** Defensively narrows the API's enrichments payload into typed results. */
function toEnrichments(value: unknown): EnrichmentResult[] {
  if (!Array.isArray(value)) return [];
  const out: EnrichmentResult[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id =
      typeof rec.id === 'number' && Number.isFinite(rec.id) && rec.id >= 1
        ? Math.floor(rec.id)
        : null;
    if (id === null) continue;
    const email =
      typeof rec.email === 'string' && rec.email.includes('@') ? rec.email.trim() : undefined;
    const emailStatus =
      typeof rec.emailStatus === 'string' && rec.emailStatus.trim()
        ? rec.emailStatus.trim()
        : undefined;
    out.push({ id, email, emailStatus });
  }
  return out;
}

export default function ChatClient() {
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME, createdAt: '' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [enrichingIds, setEnrichingIds] = useState<number[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConversationId(getOrCreateConversationId());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = endRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, sending]);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || sending || !conversationId) return;

      const userMessage: UiMessage = {
        id: generateId(),
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSending(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId }),
        });
        const data = (await response.json().catch(() => null)) as {
          reply?: unknown;
          error?: unknown;
          status?: unknown;
          candidates?: unknown;
        } | null;
        const replyText =
          data && typeof data.reply === 'string' && data.reply.trim() ? data.reply : null;
        const errorCode = data && typeof data.error === 'string' ? data.error : null;
        const upstreamStatus =
          data && typeof data.status === 'number' && data.status > 0 ? data.status : null;
        const candidates = response.ok && !errorCode ? toUiCandidates(data?.candidates) : [];
        // Surface the real upstream failure instead of a generic fallback so
        // problems are debuggable straight from the chat.
        const reply =
          replyText ??
          (errorCode
            ? `The search didn't complete (${errorCode}${upstreamStatus ? `, upstream HTTP ${upstreamStatus}` : ''}). Please try again in a moment.`
            : "I couldn't complete that request. Please try again in a moment.");
        const isNotice = !response.ok || Boolean(errorCode) || isFallbackReply(reply);
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: reply,
            createdAt: new Date().toISOString(),
            isNotice,
            candidates: !isNotice && candidates.length > 0 ? candidates : undefined,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: 'I had trouble reaching the search service. Please try again in a moment.',
            createdAt: new Date().toISOString(),
            isNotice: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  /**
   * Enriches ALL selected candidates in ONE request, keeping the SAME session
   * conversationId so the workflow matches its stored candidates by id.
   * Body shape (unchanged contract): the route forwards this message as
   * { input: "enrich: <comma-separated ids>", conversationId }.
   * Results are merged back onto the SAME cards — no separate list.
   */
  const sendEnrich = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0 || sending || !conversationId) return;
      const message = `enrich: ${ids.join(',')}`;

      const userMessage: UiMessage = {
        id: generateId(),
        role: 'user',
        content: `Enrich selected contact${ids.length > 1 ? 's' : ''}: ${ids.join(', ')}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setSending(true);
      setEnrichingIds(ids);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId }),
        });
        const data = (await response.json().catch(() => null)) as {
          reply?: unknown;
          error?: unknown;
          status?: unknown;
          enrichments?: unknown;
        } | null;
        const replyText =
          data && typeof data.reply === 'string' && data.reply.trim() ? data.reply : null;
        const errorCode = data && typeof data.error === 'string' ? data.error : null;
        const upstreamStatus =
          data && typeof data.status === 'number' && data.status > 0 ? data.status : null;
        const enrichments = response.ok && !errorCode ? toEnrichments(data?.enrichments) : [];

        // Merge enrichment results back onto the SAME cards, in place.
        if (enrichments.length > 0) {
          const byId = new Map(enrichments.map((e) => [e.id, e]));
          setMessages((prev) =>
            prev.map((m) => {
              if (!m.candidates || m.candidates.length === 0) return m;
              return {
                ...m,
                candidates: m.candidates.map((c) => {
                  const pid = c.id ?? c.index;
                  const hit = byId.get(pid);
                  if (hit) {
                    return {
                      ...c,
                      email: hit.email,
                      emailStatus: hit.email ? hit.emailStatus : hit.emailStatus ?? 'unavailable',
                    };
                  }
                  // Requested but not returned → Apollo found no email for it.
                  if (ids.includes(pid) && !c.email) {
                    return { ...c, emailStatus: 'unavailable' };
                  }
                  return c;
                }),
              };
            }),
          );
        }

        const reply =
          replyText ??
          (errorCode
            ? `The enrichment didn't complete (${errorCode}${upstreamStatus ? `, upstream HTTP ${upstreamStatus}` : ''}). Please try again in a moment.`
            : "I couldn't complete that request. Please try again in a moment.");
        const isNotice = !response.ok || Boolean(errorCode) || isFallbackReply(reply);
        // The enrich reply is appended as plain text only — results already
        // merged onto the existing cards, never rendered as a second list.
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: reply,
            createdAt: new Date().toISOString(),
            isNotice,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content:
              'I had trouble reaching the enrichment service. Your selection is safe — please try again in a moment.',
            createdAt: new Date().toISOString(),
            isNotice: true,
          },
        ]);
      } finally {
        setSending(false);
        setEnrichingIds([]);
      }
    },
    [conversationId, sending],
  );

  const pickNumbers = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.id === 'welcome' || last.isNotice) return [];

    // Structured cards handle their own multi-select + Enrich flow — never
    // duplicate them with quick-pick buttons.
    if (last.candidates && last.candidates.length > 0) return [];

    // Fallback: require a second, independent signal beyond mere numbering so
    // plain numbered instructions never trigger quick-pick buttons: the
    // message must also mention company/title context or explicitly ask for a
    // number.
    const hasCandidateContext =
      /\b(company|title)\b/i.test(last.content) ||
      /reply with (?:the )?number|which one/i.test(last.content);
    if (!hasCandidateContext) return [];

    const found = new Set<number>();
    const regex = /^\s{0,3}(\d{1,2})[.)]\s+/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(last.content)) !== null) {
      const n = Number(match[1]);
      if (n >= 1 && n <= 10) found.add(n);
    }
    const sorted = Array.from(found).sort((a, b) => a - b);
    return sorted.length >= 2 ? sorted : [];
  }, [messages]);

  return (
    <div className="app">
      <ParticleField />
      <div className="glow glow-blue" aria-hidden="true" />
      <div className="glow glow-purple" aria-hidden="true" />
      <div className="glow glow-teal" aria-hidden="true" />

      <header className="app-header">
        <div className="brand-mark">PL</div>
        <div>
          <div className="brand-title">Prospect Lens Console</div>
          <div className="brand-sub">Find &middot; Select &middot; Enrich</div>
        </div>
        <div className="header-status">
          <span className="status-dot" />
          <span>Live</span>
        </div>
      </header>

      <div className="messages">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isWelcome = msg.id === 'welcome';
          const hasCards = Boolean(msg.candidates && msg.candidates.length > 0);
          const bubbleClass = isUser
            ? 'bubble bubble-user'
            : `bubble bubble-assistant${isWelcome ? ' bubble-welcome' : ''}${msg.isNotice ? ' bubble-notice' : ''}`;
          return (
            <div key={msg.id} className={isUser ? 'row row-user' : 'row row-assistant'}>
              <div className="msg-group">
                <div className="msg-meta">
                  <span className="msg-avatar" aria-hidden="true" />
                  <span className="msg-role">{isUser ? 'You' : 'Prospect Lens'}</span>
                  {msg.isNotice && <span className="msg-notice-tag">didn&apos;t fully complete</span>}
                  {msg.createdAt && (
                    <span className="msg-time">{formatRelativeTime(msg.createdAt, now)}</span>
                  )}
                </div>
                <div className={bubbleClass}>
                  {msg.role === 'assistant' ? (
                    <>
                      {/* Once structured cards are present, the plain-text intro is hidden — the cards ARE the result. */}
                      {!hasCards && <Markdown content={msg.content} />}
                      {msg.candidates && msg.candidates.length > 0 && (
                        <CandidateCards
                          candidates={msg.candidates}
                          disabled={sending}
                          enrichingIds={enrichingIds}
                          onEnrich={(ids) => void sendEnrich(ids)}
                        />
                      )}
                    </>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="row row-assistant">
            <TypingIndicator />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {pickNumbers.length > 0 && !sending && (
        <div className="pick-row">
          <span className="pick-label">Quick pick</span>
          {pickNumbers.map((n) => (
            <button key={n} type="button" className="pick-btn" onClick={() => void send(String(n))}>
              {n}
            </button>
          ))}
          <button
            type="button"
            className="pick-btn pick-all"
            onClick={() => void send(pickNumbers.join(','))}
          >
            All
          </button>
        </div>
      )}

      <QuickChips phrases={QUICK_PHRASES} disabled={sending} onPick={(m) => void send(m)} />

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="composer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a contact, e.g. Find the CMO of Vercel"
          aria-label="Message"
        />
        <button
          type="submit"
          className="send-btn"
          disabled={sending || !input.trim() || !conversationId}
        >
          {sending ? 'Searching…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
