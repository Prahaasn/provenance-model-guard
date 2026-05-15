import type { CheckDefinition, CheckIssue } from '../types.js';

const CELL_REF_RE = /\$?[A-Z]+\$?\d+/g;
const NUMBER_RE = /(?<![A-Za-z_$])(?<![\d.])\d+(?:\.\d+)?/g;

function normalize(formula: string): string {
  return formula.replace(CELL_REF_RE, 'REF').replace(NUMBER_RE, 'NUM');
}

export const formulaConsistency: CheckDefinition = {
  id: 'formula-consistency',
  name: 'Formula consistency across rows',
  description:
    'Within a row of formulas, flags cells whose normalized formula pattern differs from the dominant pattern.',
  defaultSeverity: 'HIGH',
  passMessage: 'All row-wise formula patterns are consistent.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      for (const row of sheet.cells) {
        // Group formula cells into contiguous runs separated by any non-formula
        // cell (empty, text, or number). Consistency is only meaningful within
        // a run — formulas separated by gaps are usually structurally distinct
        // (e.g. years B..F vs. a terminal-value column in I).
        const runs: typeof row[] = [];
        let cur: typeof row = [];
        for (const cell of row) {
          if (cell.type === 'formula' && cell.formula) {
            cur.push(cell);
          } else {
            if (cur.length > 0) runs.push(cur);
            cur = [];
          }
        }
        if (cur.length > 0) runs.push(cur);

        for (const formulaCells of runs) {
          if (formulaCells.length < 3) continue;
          const patterns = new Map<string, number>();
          const cellToPattern = new Map<string, string>();
          for (const cell of formulaCells) {
            const pat = normalize(cell.formula!);
            patterns.set(pat, (patterns.get(pat) ?? 0) + 1);
            cellToPattern.set(cell.address, pat);
          }
          if (patterns.size < 2) continue;
          // Find dominant pattern
          let dominant: string | null = null;
          let dominantCount = 0;
          for (const [pat, count] of patterns) {
            if (count > dominantCount) {
              dominant = pat;
              dominantCount = count;
            }
          }
          if (dominantCount < 2 || !dominant) continue;
          for (const cell of formulaCells) {
            const pat = cellToPattern.get(cell.address);
            if (pat !== dominant) {
              issues.push({
                checkId: 'formula-consistency',
                severity: 'HIGH',
                sheet: sheet.name,
                cell: cell.address,
                row: cell.row,
                col: cell.col,
                description: `Formula =${cell.formula} differs from the dominant pattern in row ${cell.row + 1}`,
                suggestion:
                  'Confirm whether this cell intentionally deviates — otherwise copy the dominant formula across the row.',
                fingerprint: `formula-consistency|${sheet.name}|${cell.address}|${pat ?? ''}`,
              });
            }
          }
        }
      }
    }
    return issues;
  },
};
