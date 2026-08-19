"use client"

import { useState } from 'react';
import { HistoryPanel } from '@/components/HistoryPanel';

/**
 * Top "History" button. The history panel is no longer a persistent
 * right-side column — clicking this button opens the SAME HistoryPanel
 * (unchanged) inside a slide-over drawer anchored to the right edge.
 */
export function HistoryToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="hist-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        History
      </button>
      {open ? (
        <>
          <div className="hist-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="hist-drawer" role="dialog" aria-label="Search history">
            <button
              type="button"
              className="hist-close"
              onClick={() => setOpen(false)}
              aria-label="Close history"
            >
              ✕
            </button>
            <HistoryPanel />
          </div>
        </>
      ) : null}
    </>
  );
}
