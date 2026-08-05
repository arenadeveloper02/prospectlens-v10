"use client"

import { useState } from 'react';
import type { CandidateCard } from '@/lib/types';

interface CandidateCardsProps {
  candidates: CandidateCard[];
  disabled: boolean;
  /** Called with the candidate's stored id (falls back to index) — the number the workflow matches on. */
  onPick: (id: number) => void;
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

export function CandidateCards({ candidates, disabled, onPick }: CandidateCardsProps) {
  if (candidates.length === 0) return null;
  return (
    <div className="cand-list">
      {candidates.map((c) => {
        const pickId = c.id ?? c.index;
        return (
          <div key={`${pickId}-${c.name}`} className="cand-card">
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
            </span>
            <span className="cand-actions">
              {c.linkedin && (
                <a
                  className="cand-linkedin"
                  href={c.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${c.name} on LinkedIn (opens in a new tab)`}
                >
                  View LinkedIn
                </a>
              )}
              <button
                type="button"
                className="cand-select"
                disabled={disabled}
                onClick={() => onPick(pickId)}
                aria-label={`Select candidate ${pickId}: ${c.name}`}
              >
                Select {pickId} →
              </button>
            </span>
          </div>
        );
      })}
      <p className="cand-hint">
        Tap Select (or reply with the number) to enrich that contact with a verified email.
      </p>
    </div>
  );
}
