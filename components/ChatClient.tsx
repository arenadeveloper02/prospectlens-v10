"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UiMessage, QuickPhrase } from '@/lib/types';
import { Markdown } from '@/components/Markdown';
import { TypingIndicator } from '@/components/TypingIndicator';
import { QuickChips } from '@/components/QuickChips';
import { ParticleField } from '@/components/ParticleField';

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
  'When I show numbered candidates, reply with a number (or tap a quick-pick) to enrich that contact with a verified email. Say "Show all my contacts" anytime to export everything as a table and CSV.',
].join('\n');

const CONVERSATION_COOKIE = 'pl_conversation_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  return /try again in a moment|shorten it and try again|catch up, then try again|start searching/i.test(
    text,
  );
}

export default function ChatClient() {
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME, createdAt: '' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState('');
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
        const data = (await response.json().catch(() => null)) as { reply?: unknown } | null;
        const reply =
          data && typeof data.reply === 'string' && data.reply.trim()
            ? data.reply
            : "I couldn't complete that request. Please try again in a moment.";
        const isNotice = !response.ok || isFallbackReply(reply);
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

  const pickNumbers = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.id === 'welcome' || last.isNotice) return [];

    // Require a second, independent signal beyond mere numbering so plain
    // numbered instructions never trigger quick-pick buttons: the message must
    // also mention company/title context or explicitly ask for a number.
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
                    <Markdown content={msg.content} />
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
          <button type="button" className="pick-btn pick-all" onClick={() => void send('All')}>
            All
          </button>
        </div>
      )}

      <QuickChips phrases={QUICK_PHRASES} disabled={sending} onPick={(message) => void send(message)} />

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <input
          className="composer-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything — e.g. Find the Head of Growth at Figma"
          disabled={sending}
          aria-label="Message"
        />
        <button type="submit" className="send-btn" disabled={sending || !input.trim()}>
          {sending ? 'Working\u2026' : 'Send'}
        </button>
      </form>
    </div>
  );
}
