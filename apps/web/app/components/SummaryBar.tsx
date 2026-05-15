'use client';

import type { IssueCounts } from '@pmg/lint-engine';

interface Props {
  counts: IssueCounts;
}

const PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium';

export function SummaryBar({ counts }: Props) {
  const items: Array<{
    label: string;
    count: number;
    cls: string;
  }> = [
    {
      label: 'CRITICAL',
      count: counts.CRITICAL,
      cls: 'bg-red-950 border-red-700 text-red-300',
    },
    {
      label: 'HIGH',
      count: counts.HIGH,
      cls: 'bg-red-900/40 border-red-800 text-red-300',
    },
    {
      label: 'MEDIUM',
      count: counts.MEDIUM,
      cls: 'bg-amber-900/40 border-amber-700 text-amber-300',
    },
    {
      label: 'LOW',
      count: counts.LOW,
      cls: 'bg-orange-900/30 border-orange-800 text-orange-300',
    },
    {
      label: 'PASS',
      count: counts.passed,
      cls: 'bg-emerald-900/30 border-emerald-700 text-emerald-300',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <span
          key={it.label}
          className={[PILL_BASE, it.cls, it.count === 0 ? 'opacity-40' : ''].join(' ')}
        >
          <span>{it.label}</span>
          <span className="tabular-nums">{it.count}</span>
        </span>
      ))}
    </div>
  );
}
