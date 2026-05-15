import type { Severity, CheckStatus } from '@pmg/lint-engine';

export function severityBadgeClass(sev: Severity): string {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-950 border-red-700 text-red-300';
    case 'HIGH':
      return 'bg-red-900/40 border-red-800 text-red-300';
    case 'MEDIUM':
      return 'bg-amber-900/40 border-amber-700 text-amber-300';
    case 'LOW':
      return 'bg-orange-900/30 border-orange-800 text-orange-300';
  }
}

export function passBadgeClass(): string {
  return 'bg-emerald-900/30 border-emerald-700 text-emerald-300';
}

export function statusBadgeClass(status: CheckStatus, severity: Severity): string {
  if (status === 'PASS') return passBadgeClass();
  return severityBadgeClass(severity);
}

export function severityRank(sev: Severity): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[sev];
}

export function scoreColorClass(score: number): {
  ring: string;
  text: string;
  label: string;
} {
  if (score >= 85) {
    return { ring: 'stroke-emerald-400', text: 'text-emerald-300', label: 'Healthy' };
  }
  if (score >= 60) {
    return { ring: 'stroke-amber-400', text: 'text-amber-300', label: 'Needs review' };
  }
  return { ring: 'stroke-red-400', text: 'text-red-300', label: 'High risk' };
}

export function formatPercent(score: number): string {
  return `${Math.round(score)}`;
}
