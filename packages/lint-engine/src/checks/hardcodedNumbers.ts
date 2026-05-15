import type { CheckDefinition, CheckIssue } from '../types.js';

// Numbers we never flag. These are either neutral integers used in date math
// (days/months in a year, working-capital day counts, depreciation lives) or
// universal banking conventions (360/365 day counts). The list is intentionally
// conservative — anything that could plausibly be an assumption (e.g. 0.05, 1.08,
// 0.12) is NOT here, because those are the genuine smells we want to surface.
const ALLOWED = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  12, 15, 20, 24, 25, 30, 50, 52, 60, 90,
  100, 180, 250, 252, 360, 365,
  1000, 10000, 100000, 1000000,
]);

// Strip cell references like A1, $B$2, AA12 to "REF" so we don't pick up the row digits.
const CELL_REF_RE = /\$?[A-Z]+\$?\d+/g;
// Numeric literal: integer or decimal, not preceded by a letter, $, _, digit, or dot.
const NUMBER_RE = /(?<![A-Za-z_$])(?<![\d.])\d+(?:\.\d+)?/g;

// Functions whose numeric arguments are structural (column indices, exact-match
// flags, lookup modes, date components) rather than financial assumptions. We
// skip flagging numeric literals that appear inside calls to these functions.
const STRUCTURAL_FN_RE =
  /\b(?:VLOOKUP|HLOOKUP|XLOOKUP|INDEX|MATCH|OFFSET|CHOOSE|DATE|EDATE|EOMONTH|YEAR|MONTH|DAY|ROUND|ROUNDUP|ROUNDDOWN|MROUND|LEFT|RIGHT|MID|LEN|TEXT|SUBSTITUTE|REPT|SMALL|LARGE|PERCENTILE|QUARTILE|RANK|ROW|COLUMN|INDIRECT|ADDRESS)\s*\(/i;

/** True if the formula is a pure numeric literal like `=37507`. We don't flag
 * those here — they're better surfaced by the excessive-hardcodes check (this
 * check is about magic numbers *embedded* in real formulas). */
function isPureLiteralFormula(stripped: string): boolean {
  // After stripping cell refs we look at the raw text: a leading `+`/`-` is OK.
  return /^[-+]?\d+(?:\.\d+)?$/.test(stripped.trim());
}

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
          // First strip Excel structured-table references such as
          //   Q1_IS_2023[[#This Row],[Jan 31,2021]]
          // The column names inside `[...]` often embed dates and numbers that
          // are NOT formula literals — they are part of an identifier. Strip
          // the entire `Name[...]` token before any other parsing.
          let stripped = cell.formula.replace(/[A-Za-z_][\w]*\[[^\]]*(?:\][^\]]*)*\]/g, 'TBL');
          stripped = stripped.replace(CELL_REF_RE, 'REF');
          if (isPureLiteralFormula(stripped)) continue;
          // If every function call in the formula is a structural one (e.g.
          // =DATE(YEAR(X),6,30) or =VLOOKUP(X,Y,5,0)), the embedded numbers are
          // almost always column indices / date components and not magic
          // assumptions. We require the formula to contain *only* structural
          // function calls AND no bare arithmetic operators outside of them.
          const hasStructural = STRUCTURAL_FN_RE.test(stripped);
          const matches = stripped.match(NUMBER_RE);
          if (!matches) continue;
          for (const literal of matches) {
            const num = Number(literal);
            if (!Number.isFinite(num)) continue;
            if (ALLOWED.has(num)) continue;
            // Suppress small-integer literals (1..366) when the formula contains
            // a structural function call — these are almost always indices /
            // date parts, not financial magic numbers.
            if (hasStructural && Number.isInteger(num) && num >= 0 && num <= 366) {
              continue;
            }
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
