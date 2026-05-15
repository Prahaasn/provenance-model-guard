import type { CheckDefinition, CheckIssue } from '../types.js';

const ALLOWED = new Set([0, 1, 2, 4, 12, 100, 365, 1000, 10000, 100000, 1000000]);

// Strip cell references like A1, $B$2, AA12 to "REF" so we don't pick up the row digits.
const CELL_REF_RE = /\$?[A-Z]+\$?\d+/g;
// Numeric literal: integer or decimal, not preceded by a letter, $, _, digit, or dot.
const NUMBER_RE = /(?<![A-Za-z_$])(?<![\d.])\d+(?:\.\d+)?/g;

export const hardcodedNumbers: CheckDefinition = {
  id: 'hardcoded-numbers',
  name: 'Hardcoded numbers in formulas',
  description:
    'Flags numeric literals embedded inside formulas (other than common safe constants).',
  defaultSeverity: 'HIGH',
  passMessage: 'No suspicious hardcoded numbers found in formulas.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      for (const row of sheet.cells) {
        for (const cell of row) {
          if (cell.type !== 'formula' || !cell.formula) continue;
          const stripped = cell.formula.replace(CELL_REF_RE, 'REF');
          const matches = stripped.match(NUMBER_RE);
          if (!matches) continue;
          for (const literal of matches) {
            const num = Number(literal);
            if (!Number.isFinite(num)) continue;
            if (ALLOWED.has(num)) continue;
            issues.push({
              checkId: 'hardcoded-numbers',
              severity: 'HIGH',
              sheet: sheet.name,
              cell: cell.address,
              row: cell.row,
              col: cell.col,
              description: `Hardcoded number ${literal} in formula =${cell.formula}`,
              suggestion:
                'Move the magic number to a named input cell on an assumptions sheet and reference it instead.',
              fingerprint: `hardcoded-numbers|${sheet.name}|${cell.address}|${literal}`,
            });
          }
        }
      }
    }
    return issues;
  },
};
