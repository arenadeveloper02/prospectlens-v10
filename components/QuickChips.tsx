"use client"

import type { QuickPhrase } from '@/lib/types';

interface QuickChipsProps {
  phrases: QuickPhrase[];
  disabled: boolean;
  onPick: (message: string) => void;
}

export function QuickChips({ phrases, disabled, onPick }: QuickChipsProps) {
  return (
    <div className="chips">
      {phrases.map((phrase) => (
        <button
          key={phrase.label}
          type="button"
          className="chip"
          disabled={disabled}
          onClick={() => onPick(phrase.message)}
        >
          {phrase.label}
        </button>
      ))}
    </div>
  );
}
