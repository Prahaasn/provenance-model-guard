'use client';

import { FileText, GitCompareArrows } from 'lucide-react';

export type Mode = 'single' | 'diff';

interface Props {
  mode: Mode;
  onChange: (m: Mode) => void;
}

export function ModeSwitcher({ mode, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Lint mode"
      className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1"
    >
      <button
        role="tab"
        aria-selected={mode === 'single'}
        onClick={() => onChange('single')}
        className={[
          'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          mode === 'single'
            ? 'bg-sky-300 text-zinc-900'
            : 'text-text-secondary hover:text-text-primary',
        ].join(' ')}
      >
        <FileText className="h-3.5 w-3.5" />
        Single workbook
      </button>
      <button
        role="tab"
        aria-selected={mode === 'diff'}
        onClick={() => onChange('diff')}
        className={[
          'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          mode === 'diff'
            ? 'bg-sky-300 text-zinc-900'
            : 'text-text-secondary hover:text-text-primary',
        ].join(' ')}
      >
        <GitCompareArrows className="h-3.5 w-3.5" />
        Diff (v1 → v2)
      </button>
    </div>
  );
}
