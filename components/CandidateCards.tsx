"use client"

import type { CandidateCard } from '@/lib/types';

interface CandidateCardsProps {
  candidates: CandidateCard[];
  disabled: boolean;
  onPick: (index: number) => void;
}

export function CandidateCards({ candidates, disabled, onPick }: CandidateCardsProps) {
  if (candidates.length === 0) return null;
  return (
    <div className="cand-list">
      {candidates.map((c) => (
        <button
          key={`${c.index}-${c.name}`}
          type="button"
          className="cand-card"
          disabled={disabled}
          onClick={() => onPick(c.index)}
          aria-label={`Select candidate ${c.index}: ${c.name}`}
        >
          <span className="cand-num">{c.index}</span>
          <span className="cand-body">
            <span className="cand-name">{c.name}</span>
            {(c.title || c.company) && (
              <span className="cand-line">
                {c.title}
                {c.title && c.company ? ' · ' : ''}
                {c.company}
              </span>
            )}
            {c.linkedin && (
              <a
                className="cand-link"
                href={c.linkedin}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                LinkedIn profile
              </a>
            )}
          </span>
          <span className="cand-cta">Enrich →</span>
        </button>
      ))}
      <p className="cand-hint">Tap a card (or reply with its number) to enrich that contact with a verified email.</p>
    </div>
  );
}
