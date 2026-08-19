"use client"

import { useState } from 'react';
import type { ReactNode } from 'react';
import { HistoryPanel } from '@/components/HistoryPanel';

type View = 'generator' | 'history';

/**
 * Centered agent layout: title, subtitle, Generator / History pill toggle.
 * Generator keeps the home page mounted (hidden) so search state survives
 * switching tabs. History renders the previous-runs list in-place.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('generator');

  return (
    <div className="agent-page">
      <h1 className="agent-title">Prospect Lens</h1>
      <p className="agent-sub">
        Describe the leadership you want, then enrich verified work emails
        only for the people you choose.
      </p>

      <div className="view-toggle" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          className={`view-toggle-btn${view === 'generator' ? ' is-active' : ''}`}
          aria-selected={view === 'generator'}
          onClick={() => setView('generator')}
        >
          Generator
        </button>
        <button
          type="button"
          role="tab"
          className={`view-toggle-btn${view === 'history' ? ' is-active' : ''}`}
          aria-selected={view === 'history'}
          onClick={() => setView('history')}
        >
          History
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-generator"
        hidden={view !== 'generator'}
      >
        {children}
      </div>
      {view === 'history' ? (
        <div role="tabpanel" id="panel-history">
          <HistoryPanel />
        </div>
      ) : null}
    </div>
  );
}
