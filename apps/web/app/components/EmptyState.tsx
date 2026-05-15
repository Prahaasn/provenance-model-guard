'use client';

import { FileSpreadsheet, Sparkles } from 'lucide-react';

interface Props {
  mode: 'single' | 'diff';
  onLoadSamples: (kind: 'clean' | 'messy-diff' | 'pristine') => void;
}

export function EmptyState({ mode, onLoadSamples }: Props) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border-subtle bg-surface/50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-surface">
        <FileSpreadsheet className="h-6 w-6 text-text-muted" />
      </div>
      <div>
        <div className="text-sm font-medium text-text-primary">
          No workbook loaded yet
        </div>
        <div className="mt-1 max-w-md text-xs text-text-muted">
          {mode === 'single'
            ? 'Drop an .xlsx file to score it against 8 model-health checks. Everything runs locally — your file never leaves the browser.'
            : 'Drop two workbook versions to see only the issues this version introduced. No noise from problems that were already there.'}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-text-muted">
          <Sparkles className="h-3 w-3" />
          Try a sample
        </span>
        {mode === 'single' ? (
          <>
            <button
              onClick={() => onLoadSamples('pristine')}
              className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
            >
              Pristine DCF
            </button>
            <button
              onClick={() => onLoadSamples('clean')}
              className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
            >
              Clean DCF v1
            </button>
          </>
        ) : (
          <button
            onClick={() => onLoadSamples('messy-diff')}
            className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
          >
            Load clean_dcf_v1 → messy_dcf_v2
          </button>
        )}
      </div>
    </div>
  );
}
