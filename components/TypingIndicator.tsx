"use client"

import { useEffect, useState } from 'react';

const PHASES = [
  'Searching public professional sources\u2026',
  'Scanning company leadership pages\u2026',
  'Cross-checking titles and locations\u2026',
  'Ranking the strongest matches\u2026',
  'Almost there — polishing results\u2026',
];

export function TypingIndicator() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((p) => (p + 1) % PHASES.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="typing" role="status" aria-live="polite">
      <div className="typing-dots">
        <span />
        <span />
        <span />
      </div>
      <span className="typing-text">{PHASES[phase]}</span>
    </div>
  );
}
