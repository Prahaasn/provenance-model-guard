import type { CheckDefinition, CheckIssue, ParsedSheet } from '../types.js';

const CELL_REF_RE = /\$?([A-Z]+)\$?(\d+)/g;

/**
 * Strip cross-sheet references (e.g. `Assumptions!B3`, `'Revenue Build'!$A$5`)
 * BEFORE extracting intra-sheet refs. This avoids false self-loops on cells
 * like `DCF!B3 = 'Revenue Build'!B3 * Assumptions!B8`, where the row digits
 * of cross-sheet refs would otherwise look like local refs after a naive
 * sheet-prefix strip.
 */
function stripCrossSheetRefs(formula: string): string {
  // 1. Quoted-sheet refs: 'Sheet With Spaces'!$A$1 → ''
  let s = formula.replace(/'[^']+'!\$?[A-Z]+\$?\d+/g, '');
  // 2. Unquoted-sheet refs: Sheet1!A1 → ''
  s = s.replace(/[A-Za-z_][\w]*!\$?[A-Z]+\$?\d+/g, '');
  return s;
}

function extractRefs(formula: string): string[] {
  const refs: string[] = [];
  for (const m of formula.matchAll(CELL_REF_RE)) {
    const col = m[1];
    const row = m[2];
    if (!col || !row) continue;
    refs.push(`${col}${row}`);
  }
  return refs;
}

function detectCycles(sheet: ParsedSheet): string[][] {
  // Build adjacency list of formula-cell -> referenced cells (within the sheet only).
  const graph = new Map<string, string[]>();
  for (const row of sheet.cells) {
    for (const cell of row) {
      if (cell.type !== 'formula' || !cell.formula) continue;
      // Strip cross-sheet refs entirely (including their cell address) before
      // extracting intra-sheet refs. This prevents the row digits of cross-sheet
      // refs from being mistaken for local refs (e.g. on `'Revenue Build'!B3`).
      const stripped = stripCrossSheetRefs(cell.formula);
      const refs = extractRefs(stripped);
      graph.set(cell.address, refs);
    }
  }

  // DFS with color marking. Record discovered cycles (as sorted unique sets).
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seenCycles = new Set<string>();

  function dfs(node: string): void {
    color.set(node, GRAY);
    stack.push(node);
    const neighbors = graph.get(node) ?? [];
    for (const next of neighbors) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        // Found a back edge -> cycle. Extract the slice of the stack from `next` to current.
        const idx = stack.indexOf(next);
        if (idx >= 0) {
          const cycleNodes = stack.slice(idx);
          const key = [...cycleNodes].sort().join(',');
          if (!seenCycles.has(key)) {
            seenCycles.add(key);
            cycles.push(cycleNodes);
          }
        }
      } else if (c === WHITE && graph.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const node of graph.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      dfs(node);
    }
  }

  return cycles;
}

export const circularRefs: CheckDefinition = {
  id: 'circular-refs',
  name: 'Circular references',
  description: 'Detects cycles in intra-sheet formula dependency graphs.',
  defaultSeverity: 'CRITICAL',
  passMessage: 'No circular references detected.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      const cycles = detectCycles(sheet);
      for (const cycle of cycles) {
        const sorted = [...cycle].sort();
        const key = sorted.join(',');
        const firstCell = cycle[0];
        issues.push({
          checkId: 'circular-refs',
          severity: 'CRITICAL',
          sheet: sheet.name,
          cell: firstCell,
          description: `Circular reference involving cells: ${cycle.join(' -> ')} -> ${firstCell}`,
          suggestion:
            'Break the cycle by introducing an intermediate input or using iterative calc deliberately with documentation.',
          fingerprint: `circular-refs|${sheet.name}|${key}`,
        });
      }
    }
    return issues;
  },
};
