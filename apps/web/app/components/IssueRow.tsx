'use client';

import type { CheckIssue } from '@pmg/lint-engine';

interface Props {
  issue: CheckIssue;
  isNew?: boolean;
}

export function IssueRow({ issue, isNew }: Props) {
  return (
    <li className="group relative -mx-4 flex flex-col gap-1 rounded-md px-4 py-2.5 transition-colors hover:bg-surface-2">
      <div className="flex items-baseline gap-3">
        <span className="shrink-0 rounded border border-border-subtle bg-base px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
          {issue.sheet}
          {issue.cell ? `!${issue.cell}` : ''}
        </span>
        <span className="text-sm text-text-primary">{issue.description}</span>
        {isNew ? (
          <span className="ml-auto shrink-0 rounded-full border border-red-700 bg-red-900/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
            new
          </span>
        ) : null}
      </div>
      {issue.suggestion ? (
        <div className="pl-[calc(0.75rem+1.25rem)] text-xs text-text-muted">
          <span className="text-text-secondary">Suggestion:</span> {issue.suggestion}
        </div>
      ) : null}
    </li>
  );
}
