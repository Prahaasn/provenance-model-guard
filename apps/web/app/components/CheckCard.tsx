'use client';

import { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertOctagon, Info, CheckCircle2 } from 'lucide-react';
import type { CheckResult } from '@pmg/lint-engine';
import { statusBadgeClass, severityRank } from '../../lib/format';
import { IssueRow } from './IssueRow';

interface Props {
  check: CheckResult;
  newFingerprints?: Set<string>;
}

export function CheckCard({ check, newFingerprints }: Props) {
  const isPass = check.status === 'PASS';
  const [open, setOpen] = useState(!isPass && check.issues.length > 0);

  const Icon = isPass
    ? CheckCircle2
    : check.defaultSeverity === 'CRITICAL'
    ? AlertOctagon
    : check.defaultSeverity === 'HIGH'
    ? AlertTriangle
    : Info;

  const sortedIssues = [...check.issues].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );

  const sheetCount = new Set(check.issues.map((i) => i.sheet)).size;

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border bg-surface transition-colors',
        isPass ? 'border-border-subtle' : 'border-border-accent',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <Icon
          className={[
            'h-4 w-4 shrink-0',
            isPass ? 'text-emerald-400' : 'text-amber-300',
          ].join(' ')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={[
                'truncate text-sm font-medium',
                isPass ? 'text-text-secondary' : 'text-text-primary',
              ].join(' ')}
            >
              {check.name}
            </span>
            <span
              className={[
                'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                statusBadgeClass(check.status, check.defaultSeverity),
              ].join(' ')}
            >
              {isPass ? 'PASS' : check.defaultSeverity}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-text-muted">
            {isPass
              ? check.passMessage
              : `${check.issues.length} issue${check.issues.length === 1 ? '' : 's'}${
                  sheetCount > 0
                    ? ` across ${sheetCount} sheet${sheetCount === 1 ? '' : 's'}`
                    : ''
                }`}
          </div>
        </div>
        {!isPass ? (
          <ChevronDown
            className={[
              'h-4 w-4 shrink-0 text-text-muted transition-transform',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        ) : null}
      </button>

      {open && !isPass && check.issues.length > 0 ? (
        <div className="border-t border-border-subtle bg-base/40 px-4 py-2">
          <ul className="divide-y divide-border-subtle/50">
            {sortedIssues.map((iss, idx) => (
              <IssueRow
                key={`${iss.fingerprint}-${idx}`}
                issue={iss}
                isNew={newFingerprints?.has(iss.fingerprint)}
              />
            ))}
          </ul>
          {check.description ? (
            <div className="mt-2 border-t border-border-subtle/50 pt-2 text-xs text-text-muted">
              {check.description}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
