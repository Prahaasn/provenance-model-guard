import type { CheckIssue, IssueCounts, Severity } from './types.js';

const PENALTY: Record<Severity, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 4,
  LOW: 2,
};

export function computeScore(issues: CheckIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= PENALTY[issue.severity];
  }
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}

export function emptyCounts(): IssueCounts {
  return {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    passed: 0,
    failed: 0,
    warned: 0,
  };
}

export function countIssues(issues: CheckIssue[]): Pick<IssueCounts, Severity> {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}
