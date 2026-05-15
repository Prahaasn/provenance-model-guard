import type { CheckDefinition, CheckIssue } from '../types.js';

const OUTPUT_SHEET_RE = /output|summary|returns|valuation/i;

export const valueJumps: CheckDefinition = {
  id: 'value-jumps',
  name: 'Suspicious value jumps in output rows',
  description:
    'Flags adjacent values in output rows that differ by more than 3x — often a sign of a stray formula.',
  defaultSeverity: 'MEDIUM',
  passMessage: 'No suspicious jumps detected between adjacent output values.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      if (!OUTPUT_SHEET_RE.test(sheet.name)) continue;
      for (let r = 0; r < sheet.cells.length; r++) {
        const row = sheet.cells[r];
        if (!row) continue;
        const numericCells = row.filter(
          (c) =>
            (c.type === 'number' || c.type === 'formula') && typeof c.value === 'number',
        );
        if (numericCells.length < 3) continue;
        for (let i = 1; i < numericCells.length; i++) {
          const prev = numericCells[i - 1];
          const cur = numericCells[i];
          if (!prev || !cur) continue;
          const a = prev.value as number;
          const b = cur.value as number;
          if (Math.abs(a) <= 0.01 || Math.abs(b) <= 0.01) continue;
          const ratio = b / a;
          const absRatio = Math.abs(ratio);
          if (absRatio > 3 || absRatio < 1 / 3) {
            issues.push({
              checkId: 'value-jumps',
              severity: 'MEDIUM',
              sheet: sheet.name,
              cell: cur.address,
              row: cur.row,
              col: cur.col,
              description: `Value at ${cur.address} (${b}) jumps ${ratio.toFixed(2)}x from ${prev.address} (${a}).`,
              suggestion:
                'Confirm the underlying formula — large period-over-period jumps usually indicate a referencing or units bug.',
              fingerprint: `value-jumps|${sheet.name}|${cur.address}`,
            });
          }
        }
      }
    }
    return issues;
  },
};
