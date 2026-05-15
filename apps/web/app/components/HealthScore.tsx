'use client';

import { scoreColorClass, formatPercent } from '../../lib/format';

interface Props {
  score: number;
  fileName?: string;
}

export function HealthScore({ score, fileName }: Props) {
  const { ring, text, label } = scoreColorClass(score);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#26262c"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={`transition-all duration-700 ${ring}`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-3xl font-semibold tracking-tight ${text}`}>
            {formatPercent(clamped)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            / 100
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-text-muted">
          Model health score
        </div>
        <div className={`mt-1 text-xl font-semibold ${text}`}>{label}</div>
        {fileName ? (
          <div className="mt-1 truncate text-sm text-text-secondary">
            {fileName}
          </div>
        ) : null}
      </div>
    </div>
  );
}
