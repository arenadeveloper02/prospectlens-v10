"use client"

import { useEffect, useState } from 'react';
import type { CandidateCard } from '@/lib/types';

interface CandidateCardsProps {
  candidates: CandidateCard[];
  disabled: boolean;
  /** Candidate ids currently being enriched — those cards show a spinner. */
  enrichingIds: number[];
  /** Called ONCE with every selected id — sends a single enrich request. */
  onEnrich: (ids: number[]) => void;
}

/** First letters of the first + last name, e.g. "Guillermo Rauch" → "GR". */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts.length > 0 ? (parts[0] ?? '').charAt(0) : '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '').charAt(0) : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || '?';
}

interface CandidateAvatarProps {
  name: string;
  photoUrl?: string;
}

/**
 * Rounded avatar with a soft glowing ring. photo_url can be null upstream —
 * when missing, or when the image fails to load (onError), falls back to a
 * circular initials avatar so a broken image icon is never shown.
 */
function CandidateAvatar({ name, photoUrl }: CandidateAvatarProps) {
  const [broken, setBroken] = useState(false);
  if (!photoUrl || broken) {
    return (
      <span className="cand-avatar cand-avatar-fallback" aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <img
      className="cand-avatar"
      src={photoUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

/** Verified-email row with a copy affordance. */
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
      className="cand-copy"
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

export function CandidateCards({ candidates, disabled, enrichingIds, onEnrich }: CandidateCardsProps) {
  const [selected, setSelected] = useState<number[]>([]);

  // Drop selections for cards that have since been enriched in place.
  useEffect(() => {
    setSelected((prev) => {
      const valid = prev.filter((id) => {
        const c = candidates.find((cc) => (cc.id ?? cc.index) === id);
        return c ? !(c.email || c.emailStatus) : false;
      });
      return valid.length === prev.length ? prev : valid;
    });
  }, [candidates]);

  if (candidates.length === 0) return null;

  const pickIdOf = (c: CandidateCard): number => c.id ?? c.index;
  const isEnriched = (c: CandidateCard): boolean => Boolean(c.email || c.emailStatus);
  const selectable = candidates.filter((c) => !isEnriched(c));
  const enriching = enrichingIds.length > 0;

  const toggle = (id: number) => {
    if (disabled) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="cand-list">
      {selectable.length > 0 && (
        <div className="cand-toolbar">
          <span className="cand-count">
            {selected.length} of {selectable.length} selected
          </span>
          <span className="cand-toolbar-actions">
            <button
              type="button"
              className="cand-tool-btn"
              disabled={disabled || selected.length === selectable.length}
              onClick={() => setSelected(selectable.map(pickIdOf))}
            >
              Select all
            </button>
            <button
              type="button"
              className="cand-tool-btn"
              disabled={disabled || selected.length === 0}
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </span>
        </div>
      )}

      <div className="cand-grid">
        {candidates.map((c) => {
          const pickId = pickIdOf(c);
          const enriched = isEnriched(c);
          const isSelected = selected.includes(pickId);
          const isEnriching = enrichingIds.includes(pickId);
          const cardClass = `cand-card${isSelected ? ' cand-card-selected' : ''}${
            isEnriching ? ' cand-card-enriching' : ''
          }${enriched ? ' cand-card-enriched' : ''}`;
          return (
            <div
              key={`${pickId}-${c.name}`}
              className={cardClass}
              onClick={() => {
                if (!enriched) toggle(pickId);
              }}
            >
              <span className="cand-check">
                {enriched ? (
                  <span className="cand-check-done" aria-hidden="true">
                    ✓
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    className="cand-checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => toggle(pickId)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select candidate ${pickId}: ${c.name}`}
                  />
                )}
              </span>
              <span className="cand-num" aria-hidden="true">
                {pickId}
              </span>
              <CandidateAvatar name={c.name} photoUrl={c.photoUrl} />
              <span className="cand-body">
                <span className="cand-name">{c.name}</span>
                {(c.title || c.company) && (
                  <span className="cand-line">
                    {c.title}
                    {c.title && c.company ? ' · ' : ''}
                    {c.company}
                  </span>
                )}
                {c.location && <span className="cand-loc">{c.location}</span>}
                {(c.seniority || c.confidence) && (
                  <span className="cand-badges">
                    {c.seniority && (
                      <span className="cand-badge cand-badge-seniority">{c.seniority}</span>
                    )}
                    {c.confidence && (
                      <span className="cand-badge cand-badge-confidence">{c.confidence} match</span>
                    )}
                  </span>
                )}
                {c.summary && <span className="cand-summary">{c.summary}</span>}
                {c.email && (
                  <span className="cand-email">
                    <span className="cand-email-text">{c.email}</span>
                    <CopyEmailButton email={c.email} />
                  </span>
                )}
                {!c.email && c.emailStatus && (
                  <span className="cand-noemail">No email available</span>
                )}
              </span>
              <span className="cand-actions">
                {c.linkedin && (
                  <a
                    className="cand-linkedin"
                    href={c.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${c.name} on LinkedIn (opens in a new tab)`}
                  >
                    View LinkedIn
                  </a>
                )}
                {isEnriching && <span className="cand-spinner" aria-hidden="true" />}
              </span>
            </div>
          );
        })}
      </div>

      {selectable.length > 0 && (
        <div className="cand-enrich-bar">
          <button
            type="button"
            className="cand-enrich-btn"
            disabled={disabled || selected.length === 0}
            onClick={() => onEnrich([...selected].sort((a, b) => a - b))}
          >
            {enriching
              ? 'Enriching…'
              : `Enrich ${selected.length} selected`}
          </button>
        </div>
      )}

      <p className="cand-hint">
        Select one or more candidates, then press Enrich to fetch verified emails (Apollo-only —
        never guessed).
      </p>
    </div>
  );
}
