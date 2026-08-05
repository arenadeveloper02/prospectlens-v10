"use client"

import type { CandidateCard } from '@/lib/types';

interface CandidateCardsProps {
  candidates: CandidateCard[];
  disabled: boolean;
  /** Called with the candidate's stored id (falls back to index) — the number the workflow matches on. */
  onPick: (id: number) => void;
}

export function CandidateCards({ candidates, disabled, onPick }: CandidateCardsProps) {
  if (candidates.length === 0) return null;
  return (
    <div className="cand-list">
      {candidates.map((c) => {
        const pickId = c.id ?? c.index;
        return (
          <button
            key={`${pickId}-${c.name}`}
            type="button"
            className="cand-card"
            disabled={disabled}
            onClick={() => onPick(pickId)}
            aria-label={`Select candidate ${pickId}: ${c.name}`}
          >
            <span className="cand-num">{pickId}</span>
            {c.photoUrl && (
              <img
                className="cand-photo"
                src={c.photoUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
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
            <span className="cand-cta">Select {pickId} →</span>
          </button>
        );
      })}
      <p className="cand-hint">
        Tap a card (or reply with its number) to enrich that contact with a verified email.
      </p>
    </div>
  );
}
