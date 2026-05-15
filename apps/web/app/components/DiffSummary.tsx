'use client';

import { Plus, Check, Equal } from 'lucide-react';
import type { DiffReport } from '@pmg/lint-engine';

interface Props {
  report: DiffReport;
}

export function DiffSummary({ report }: Props) {
  const items = [
    {
      label: 'New issues',
      count: report.newFingerprints.length,
      Icon: Plus,
      cls: 'border-red-800 bg-red-900/30 text-red-300',
    },
    {
      label: 'Resolved',
      count: report.resolvedFingerprints.length,
      Icon: Check,
      cls: 'border-emerald-800 bg-emerald-900/30 text-emerald-300',
    },
    {
      label: 'Unchanged',
      count: report.unchangedFingerprints.length,
      Icon: Equal,
      cls: 'border-border-subtle bg-surface-2 text-text-secondary',
    },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ label, count, Icon, cls }) => (
        <div
          key={label}
          className={[
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm',
            cls,
          ].join(' ')}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="tabular-nums font-semibold">{count}</span>
          <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
        </div>
      ))}
      <div className="ml-auto text-xs text-text-muted">
        <span className="text-text-secondary">{report.baseFileName}</span>
        {' → '}
        <span className="text-text-primary">{report.fileName}</span>
      </div>
    </div>
  );
}
