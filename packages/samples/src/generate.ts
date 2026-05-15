/**
 * generate.ts — build three sample DCF .xlsx files for the PMG lint-tool demo.
 *
 *  clean_dcf_v1.xlsx   — mostly-clean model, score ~90
 *  messy_dcf_v2.xlsx   — same model with 7 intentional issues baked in, score ~55
 *  pristine_dcf.xlsx   — flawless model, score 100
 *
 * All financials are fictional but proportionally realistic (SaaS-ish startup, ~$100M rev base).
 */

// xlsx ships CJS only; use createRequire to load it in ESM context
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = join(__dirname, '..', 'files');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Shared financial constants (used to pre-compute values for cell v= fields)
// ---------------------------------------------------------------------------
const BASE_REV = 100_000_000;     // Year 0 (prior year) revenue for growth calcs
const GROWTH = 0.12;              // 12% revenue growth
const EBITDA_MARGIN = 0.28;       // 28% EBITDA margin
const COGS_PCT = 0.38;            // 38% COGS as % of revenue
const OPEX_PCT = 0.34;            // 34% OpEx as % of revenue
const TAX_RATE = 0.25;            // 25% tax rate
const WACC = 0.10;                // 10% WACC
const TGR = 0.025;                // 2.5% terminal growth rate
const CAPEX_PCT = 0.05;           // 5% capex as % of revenue
const NWC_PCT = 0.08;             // 8% NWC as % of revenue
const NET_DEBT = 12_000_000;      // $12M net debt
const SHARES = 25_000_000;        // 25M shares outstanding

// Pre-compute Year 1-5 revenues
const revs: number[] = [];
for (let y = 1; y <= 5; y++) {
  revs.push(Math.round(BASE_REV * Math.pow(1 + GROWTH, y)));
}

// Helper: column letter for 0-based index
function col(i: number): string {
  return String.fromCharCode(65 + i); // A=0, B=1 ...
}

// Year columns: B=Year1 ... F=Year5
const YEAR_COLS = ['B', 'C', 'D', 'E', 'F'];

// ---------------------------------------------------------------------------
// Sheet builders — return a worksheet object
// ---------------------------------------------------------------------------

/** ---- ASSUMPTIONS SHEET ---- */
function buildAssumptions(opts: {
  undocumentedCell?: boolean; // messy: add naked number in C12 with no label
} = {}): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // Helper to set a labeled assumption row
  // Row layout: A = label, B = value, C = unit/note
  const rows: Array<[string, number | string, string, string]> = [
    // [label, value, unit, note]
    ['Assumptions', '', '', ''],
    ['', '', '', ''],
    ['Revenue Growth Rate', GROWTH, '%', 'Annual YoY growth applied to revenue'],
    ['EBITDA Margin', EBITDA_MARGIN, '%', 'EBITDA as % of revenue'],
    ['Tax Rate', TAX_RATE, '%', 'Effective corporate tax rate'],
    ['WACC', WACC, '%', 'Weighted average cost of capital'],
    ['Terminal Growth Rate', TGR, '%', 'Long-run perpetuity growth rate'],
    ['Capex % of Revenue', CAPEX_PCT, '%', 'Maintenance + growth capex'],
    ['NWC % of Revenue', NWC_PCT, '%', 'Net working capital as % of revenue'],
    ['Net Debt', NET_DEBT, '$', 'Total debt less cash'],
    ['Shares Outstanding', SHARES, '#', 'Fully diluted share count'],
  ];

  // Row 1: header
  ws['A1'] = { t: 's', v: 'Assumptions' };
  ws['B1'] = { t: 's', v: 'Value' };
  ws['C1'] = { t: 's', v: 'Unit' };
  ws['D1'] = { t: 's', v: 'Notes' };

  rows.forEach((r, i) => {
    const rowNum = i + 1;
    const [label, value, unit, note] = r;
    if (label) ws[`A${rowNum}`] = { t: 's', v: label };
    if (value !== '') ws[`B${rowNum}`] = { t: 'n', v: Number(value) };
    if (unit) ws[`C${rowNum}`] = { t: 's', v: unit };
    if (note) ws[`D${rowNum}`] = { t: 's', v: note };
  });

  // Overwrite row 1 correctly (header row)
  ws['A1'] = { t: 's', v: 'Line Item' };
  ws['B1'] = { t: 's', v: 'Value' };
  ws['C1'] = { t: 's', v: 'Unit' };
  ws['D1'] = { t: 's', v: 'Notes' };

  // Named assumption values start at row 3 (A3:D11)
  // A3 = Revenue Growth Rate → B3 = 0.12
  // A4 = EBITDA Margin       → B4 = 0.28
  // A5 = Tax Rate            → B5 = 0.25
  // A6 = WACC                → B6 = 0.10
  // A7 = Terminal Growth     → B7 = 0.025
  // A8 = Capex % Revenue     → B8 = 0.05
  // A9 = NWC % Revenue       → B9 = 0.08
  // A10= Net Debt             → B10= 12000000
  // A11= Shares Outstanding   → B11= 25000000
  ws['A3'] = { t: 's', v: 'Revenue Growth Rate' };  ws['B3'] = { t: 'n', v: GROWTH };  ws['C3'] = { t: 's', v: '%' }; ws['D3'] = { t: 's', v: 'Annual YoY growth applied to revenue' };
  ws['A4'] = { t: 's', v: 'EBITDA Margin' };         ws['B4'] = { t: 'n', v: EBITDA_MARGIN }; ws['C4'] = { t: 's', v: '%' }; ws['D4'] = { t: 's', v: 'EBITDA as % of revenue' };
  ws['A5'] = { t: 's', v: 'Tax Rate' };              ws['B5'] = { t: 'n', v: TAX_RATE };      ws['C5'] = { t: 's', v: '%' }; ws['D5'] = { t: 's', v: 'Effective corporate tax rate' };
  ws['A6'] = { t: 's', v: 'WACC' };                  ws['B6'] = { t: 'n', v: WACC };           ws['C6'] = { t: 's', v: '%' }; ws['D6'] = { t: 's', v: 'Weighted average cost of capital' };
  ws['A7'] = { t: 's', v: 'Terminal Growth Rate' };  ws['B7'] = { t: 'n', v: TGR };            ws['C7'] = { t: 's', v: '%' }; ws['D7'] = { t: 's', v: 'Long-run perpetuity growth rate' };
  ws['A8'] = { t: 's', v: 'Capex % of Revenue' };   ws['B8'] = { t: 'n', v: CAPEX_PCT };      ws['C8'] = { t: 's', v: '%' }; ws['D8'] = { t: 's', v: 'Maintenance + growth capex' };
  ws['A9'] = { t: 's', v: 'NWC % of Revenue' };     ws['B9'] = { t: 'n', v: NWC_PCT };        ws['C9'] = { t: 's', v: '%' }; ws['D9'] = { t: 's', v: 'Net working capital as % of revenue' };
  ws['A10'] = { t: 's', v: 'Net Debt' };             ws['B10'] = { t: 'n', v: NET_DEBT };      ws['C10'] = { t: 's', v: '$' }; ws['D10'] = { t: 's', v: 'Total debt less cash' };
  ws['A11'] = { t: 's', v: 'Shares Outstanding' };  ws['B11'] = { t: 'n', v: SHARES };        ws['C11'] = { t: 's', v: '#' }; ws['D11'] = { t: 's', v: 'Fully diluted share count' };
  // COGS % and OpEx % were previously baked into Revenue Build formulas as
  // literal 0.38 / 0.34, which the hardcoded-numbers check (correctly) flagged.
  // Promote them to named Assumptions cells so Revenue Build can reference them.
  ws['A12'] = { t: 's', v: 'COGS % of Revenue' };   ws['B12'] = { t: 'n', v: COGS_PCT };       ws['C12'] = { t: 's', v: '%' }; ws['D12'] = { t: 's', v: 'COGS as % of revenue' };
  ws['A13'] = { t: 's', v: 'OpEx % of Revenue' };   ws['B13'] = { t: 'n', v: OPEX_PCT };       ws['C13'] = { t: 's', v: '%' }; ws['D13'] = { t: 's', v: 'Operating expenses as % of revenue' };

  // Messy: undocumented numeric constant at C14 — no label in A14, no unit, no note
  // (moved from C12 since B12/B13 are now the COGS%/OpEx% assumption cells)
  if (opts.undocumentedCell) {
    ws['C14'] = { t: 'n', v: 0.035 }; // looks like a rate, no context whatsoever
    // A14, D14 left blank intentionally
  }

  ws['!ref'] = opts.undocumentedCell ? 'A1:D14' : 'A1:D13';

  return ws;
}

/** ---- REVENUE BUILD SHEET ---- */
function buildRevenueBuild(opts: {
  hardcodedGrowth?: boolean;       // issue 1: one cell uses literal 1.08 instead of Assumptions ref
  formulaBreak?: boolean;          // issue 2: one column uses a different formula pattern
  suspiciousJump?: boolean;        // issue 6: Year 3 revenue is 5x Year 2 (hardcoded)
  inlineMargins?: boolean;         // legacy: use hardcoded 0.38 / 0.34 in COGS/OpEx (kept for back-compat — not used)
} = {}): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // Header row
  ws['A1'] = { t: 's', v: 'Revenue Build ($)' };
  ws['B1'] = { t: 's', v: 'Year 1' };
  ws['C1'] = { t: 's', v: 'Year 2' };
  ws['D1'] = { t: 's', v: 'Year 3' };
  ws['E1'] = { t: 's', v: 'Year 4' };
  ws['F1'] = { t: 's', v: 'Year 5' };

  // Row 2: Prior Revenue label (Year 0 anchor — just a label + constant)
  ws['A2'] = { t: 's', v: 'Prior Year Revenue' };
  ws['B2'] = { t: 'n', v: BASE_REV };
  // C2-F2: each year references the prior year cell
  ws['C2'] = { t: 'n', v: Math.round(BASE_REV * Math.pow(1 + GROWTH, 1)), f: 'B3' }; // just link
  // Actually leave C2-F2 blank — prior year is only the base anchor
  // Clear those
  delete ws['C2']; delete ws['D2']; delete ws['E2']; delete ws['F2'];

  // Row 3: Revenue
  ws['A3'] = { t: 's', v: 'Revenue' };

  // B3: Year 1 revenue = base * (1 + growth)
  ws['B3'] = { t: 'n', v: revs[0]!, f: `B2*(1+Assumptions!B3)` };

  // C3: Year 2 revenue — normal
  ws['C3'] = { t: 'n', v: revs[1]!, f: `B3*(1+Assumptions!B3)` };

  // D3: Year 3 revenue
  if (opts.suspiciousJump) {
    // Issue 6: hardcoded implausible value (5x Year 2 — looks like a typo / analyst override)
    // This cell has NO formula at all — a pure hardcode, which also triggers the magic-number check.
    ws['D3'] = { t: 'n', v: revs[1]! * 5 }; // hardcoded, no formula
  } else if (opts.hardcodedGrowth) {
    // Issue 1 (standalone): magic number 1.08 baked into formula instead of Assumptions!B3
    ws['D3'] = { t: 'n', v: Math.round(revs[1]! * 1.08), f: `C3*1.08` };
  } else {
    ws['D3'] = { t: 'n', v: revs[2]!, f: `C3*(1+Assumptions!B3)` };
  }

  // E3: Year 4 revenue
  // Issue 1 (messy only): when both suspiciousJump and hardcodedGrowth are set,
  // D3 is consumed by the jump, so we bake the 1.08 magic number into E3 instead —
  // giving the lint tool a distinct hardcoded-constant-in-formula hit.
  if (opts.suspiciousJump && opts.hardcodedGrowth) {
    ws['E3'] = { t: 'n', v: Math.round(revs[1]! * 5 * 1.08), f: `D3*1.08` }; // magic 1.08 in formula
  } else {
    ws['E3'] = { t: 'n', v: revs[3]!, f: `D3*(1+Assumptions!B3)` };
  }

  // F3: Year 5 revenue
  ws['F3'] = { t: 'n', v: revs[4]!, f: `E3*(1+Assumptions!B3)` };

  // Row 4: COGS = Revenue * Assumptions!B12 (COGS%)
  // Previously this used a literal `0.38` which the hardcoded-numbers check
  // (correctly) flagged. Now it references a named assumption cell.
  ws['A4'] = { t: 's', v: 'Cost of Goods Sold' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}4`] = { t: 'n', v: Math.round(revs[i]! * COGS_PCT), f: `${c}3*Assumptions!B12` };
  });

  // Row 5: Gross Profit = Revenue - COGS
  ws['A5'] = { t: 's', v: 'Gross Profit' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}5`] = { t: 'n', v: Math.round(revs[i]! * (1 - COGS_PCT)), f: `${c}3-${c}4` };
  });

  // Row 6: OpEx = Revenue * Assumptions!B13 (OpEx%)
  ws['A6'] = { t: 's', v: 'Operating Expenses' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}6`] = { t: 'n', v: Math.round(revs[i]! * OPEX_PCT), f: `${c}3*Assumptions!B13` };
  });

  // Row 7: EBITDA = Revenue * EBITDA margin (also should equal GP - OpEx)
  ws['A7'] = { t: 's', v: 'EBITDA' };

  if (opts.formulaBreak) {
    // Issue 2: D7 uses a different formula pattern (addition of D5+D6 instead of D3*margin)
    // B, C, E, F use Rev * margin; D uses a structurally different expression
    ['B', 'C'].forEach((c, i) => {
      ws[`${c}7`] = { t: 'n', v: Math.round(revs[i]! * EBITDA_MARGIN), f: `${c}3*Assumptions!B4` };
    });
    // D7: formula break — uses GP minus OpEx addition pattern (produces wrong sign — deliberate bug)
    ws['D7'] = { t: 'n', v: Math.round(revs[2]! * EBITDA_MARGIN), f: `D5+D6` }; // wrong: adds opex instead of subtracting
    ['E', 'F'].forEach((c, i) => {
      ws[`${c}7`] = { t: 'n', v: Math.round(revs[i + 3]! * EBITDA_MARGIN), f: `${c}3*Assumptions!B4` };
    });
  } else {
    YEAR_COLS.forEach((c, i) => {
      ws[`${c}7`] = { t: 'n', v: Math.round(revs[i]! * EBITDA_MARGIN), f: `${c}3*Assumptions!B4` };
    });
  }

  ws['!ref'] = 'A1:F7';
  return ws;
}

/** ---- DCF SHEET ---- */
function buildDCF(opts: {
  circularRef?: boolean;     // issue 3: circular reference between NWC and FCF rows
  hardcodeRow?: boolean;     // issue 7 (optional): one row is all hardcoded numbers
} = {}): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // Pre-compute DCF values for v= fields
  const ebitdas = revs.map(r => Math.round(r * EBITDA_MARGIN));
  const capexes = revs.map(r => Math.round(r * CAPEX_PCT));

  // NWC change: delta(NWC) = (NWC_PCT * Rev_curr) - (NWC_PCT * Rev_prev)
  const nwcChanges: number[] = [];
  for (let i = 0; i < 5; i++) {
    const prevRev = i === 0 ? BASE_REV : revs[i - 1]!;
    nwcChanges.push(Math.round(NWC_PCT * revs[i]! - NWC_PCT * prevRev));
  }

  const taxes = ebitdas.map(e => Math.round(e * TAX_RATE));
  const fcfs = revs.map((_, i) => ebitdas[i]! - capexes[i]! - nwcChanges[i]! - taxes[i]!);

  // Discount factors
  const discountFactors = [1, 2, 3, 4, 5].map(y => 1 / Math.pow(1 + WACC, y));
  const pvFCFs = fcfs.map((f, i) => Math.round(f * discountFactors[i]!));

  // Header
  ws['A1'] = { t: 's', v: 'Discounted Cash Flow ($)' };
  ws['B1'] = { t: 's', v: 'Year 1' };
  ws['C1'] = { t: 's', v: 'Year 2' };
  ws['D1'] = { t: 's', v: 'Year 3' };
  ws['E1'] = { t: 's', v: 'Year 4' };
  ws['F1'] = { t: 's', v: 'Year 5' };

  // Row 2: EBITDA — pull from Revenue Build
  ws['A2'] = { t: 's', v: 'EBITDA' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}2`] = { t: 'n', v: ebitdas[i]!, f: `'Revenue Build'!${c}7` };
  });

  // Row 3: Less: Capex
  ws['A3'] = { t: 's', v: 'Less: Capex' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}3`] = { t: 'n', v: capexes[i]!, f: `'Revenue Build'!${c}3*Assumptions!B8` };
  });

  // Row 4: Less: Change in NWC
  ws['A4'] = { t: 's', v: 'Less: Change in NWC' };
  if (opts.circularRef) {
    // Issue 3: Circular reference — NWC row references FCF row (row 6) which depends on NWC row
    // B4: correct formula
    ws['B4'] = { t: 'n', v: nwcChanges[0]!, f: `('Revenue Build'!B3-'Revenue Build'!B2)*Assumptions!B9` };
    // C4: normal
    ws['C4'] = { t: 'n', v: nwcChanges[1]!, f: `('Revenue Build'!C3-'Revenue Build'!B3)*Assumptions!B9` };
    // D4: circular — references D6 (FCF) which will reference D4
    ws['D4'] = { t: 'n', v: nwcChanges[2]!, f: `D6*0.12` };  // pulls from FCF row below → circular
    // E4, F4: normal
    ws['E4'] = { t: 'n', v: nwcChanges[3]!, f: `('Revenue Build'!E3-'Revenue Build'!D3)*Assumptions!B9` };
    ws['F4'] = { t: 'n', v: nwcChanges[4]!, f: `('Revenue Build'!F3-'Revenue Build'!E3)*Assumptions!B9` };
  } else {
    ws['B4'] = { t: 'n', v: nwcChanges[0]!, f: `('Revenue Build'!B3-'Revenue Build'!B2)*Assumptions!B9` };
    ws['C4'] = { t: 'n', v: nwcChanges[1]!, f: `('Revenue Build'!C3-'Revenue Build'!B3)*Assumptions!B9` };
    ws['D4'] = { t: 'n', v: nwcChanges[2]!, f: `('Revenue Build'!D3-'Revenue Build'!C3)*Assumptions!B9` };
    ws['E4'] = { t: 'n', v: nwcChanges[3]!, f: `('Revenue Build'!E3-'Revenue Build'!D3)*Assumptions!B9` };
    ws['F4'] = { t: 'n', v: nwcChanges[4]!, f: `('Revenue Build'!F3-'Revenue Build'!E3)*Assumptions!B9` };
  }

  // Row 5: Less: Taxes = EBITDA * Tax Rate
  ws['A5'] = { t: 's', v: 'Less: Taxes' };
  if (opts.hardcodeRow) {
    // Issue 7: entire tax row is hardcoded numbers — no formulas
    YEAR_COLS.forEach((c, i) => {
      ws[`${c}5`] = { t: 'n', v: taxes[i]! }; // no f= field
    });
  } else {
    YEAR_COLS.forEach((c, i) => {
      ws[`${c}5`] = { t: 'n', v: taxes[i]!, f: `${c}2*Assumptions!B5` };
    });
  }

  // Row 6: Free Cash Flow = EBITDA - Capex - NWC - Tax
  ws['A6'] = { t: 's', v: 'Free Cash Flow' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}6`] = { t: 'n', v: fcfs[i]!, f: `${c}2-${c}3-${c}4-${c}5` };
  });

  // Row 7: Discount Factor = 1 / (1+WACC)^YearIndex
  // YearIndex (row 9) is a row of literal 1..5 values (data, not formula
  // constants) so the discount factor formula avoids inline exponents like
  // ^3 / ^5 that would (correctly) trip the hardcoded-numbers check.
  ws['A7'] = { t: 's', v: 'Discount Factor' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}7`] = { t: 'n', v: Number(discountFactors[i]!.toFixed(6)), f: `1/(1+Assumptions!B6)^${c}9` };
  });

  // Row 8: PV of FCF
  ws['A8'] = { t: 's', v: 'PV of Free Cash Flow' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}8`] = { t: 'n', v: pvFCFs[i]!, f: `${c}6*${c}7` };
  });

  // Row 9: Year Index (1..5) — pure data row used by the discount factor.
  // Years are reasonable hardcoded inputs (they're data, not formula
  // constants embedded inside calculations).
  ws['A9'] = { t: 's', v: 'Year Index' };
  YEAR_COLS.forEach((c, i) => {
    ws[`${c}9`] = { t: 'n', v: i + 1 };
  });

  // Terminal Value calculations — in column H (offset to give space)
  const lastYearFCF = fcfs[4]!;
  const tvFCF = Math.round(lastYearFCF * (1 + TGR) / (WACC - TGR));
  const pvTV = Math.round(tvFCF * discountFactors[4]!);
  const npvFCF = pvFCFs.reduce((s, v) => s + v, 0);
  const enterpriseValue = npvFCF + pvTV;

  ws['H1'] = { t: 's', v: 'Terminal Value' };
  ws['H2'] = { t: 's', v: 'Terminal FCF (Year 5 * (1+TGR))' };
  ws['I2'] = { t: 'n', v: Math.round(lastYearFCF * (1 + TGR)), f: `F6*(1+Assumptions!B7)` };
  ws['H3'] = { t: 's', v: 'Gordon Growth Terminal Value' };
  ws['I3'] = { t: 'n', v: tvFCF, f: `I2/(Assumptions!B6-Assumptions!B7)` };
  ws['H4'] = { t: 's', v: 'PV of Terminal Value' };
  ws['I4'] = { t: 'n', v: pvTV, f: `I3*F7` };
  ws['H5'] = { t: 's', v: 'Sum of PV(FCF)' };
  ws['I5'] = { t: 'n', v: npvFCF, f: `SUM(B8:F8)` };
  ws['H6'] = { t: 's', v: 'Enterprise Value' };
  ws['I6'] = { t: 'n', v: enterpriseValue, f: `I4+I5` };

  ws['!ref'] = 'A1:I9';
  return ws;
}

/** ---- OUTPUT SHEET ---- */
function buildOutput(opts: {
  missingCell?: boolean; // issue 4: Net Debt cell is blank
} = {}): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  const lastYearFCF = revs.map((r, i) => {
    const e = r * EBITDA_MARGIN;
    const capex = r * CAPEX_PCT;
    const prevRev = i === 0 ? BASE_REV : revs[i - 1]!;
    const nwc = (r - prevRev) * NWC_PCT;
    const tax = e * TAX_RATE;
    return e - capex - nwc - tax;
  })[4]!;

  const tvFCF = lastYearFCF * (1 + TGR) / (WACC - TGR);
  const pvTV = tvFCF / Math.pow(1 + WACC, 5);
  const discountFactors = [1, 2, 3, 4, 5].map(y => 1 / Math.pow(1 + WACC, y));
  const fcfs = revs.map((r, i) => {
    const e = r * EBITDA_MARGIN;
    const capex = r * CAPEX_PCT;
    const prevRev = i === 0 ? BASE_REV : revs[i - 1]!;
    const nwc = (r - prevRev) * NWC_PCT;
    const tax = e * TAX_RATE;
    return e - capex - nwc - tax;
  });
  const npvFCF = fcfs.reduce((s, f, i) => s + f * discountFactors[i]!, 0);
  const enterpriseValue = Math.round(npvFCF + pvTV);
  const equityValue = enterpriseValue - NET_DEBT;
  const impliedPrice = equityValue / SHARES;

  ws['A1'] = { t: 's', v: 'Output Summary' };
  ws['B1'] = { t: 's', v: 'Value ($)' };
  ws['C1'] = { t: 's', v: 'Notes' };

  ws['A2'] = { t: 's', v: 'Enterprise Value' };
  ws['B2'] = { t: 'n', v: enterpriseValue, f: `DCF!I6` };
  ws['C2'] = { t: 's', v: 'NPV of FCFs + PV of Terminal Value' };

  ws['A3'] = { t: 's', v: 'Less: Net Debt' };
  if (!opts.missingCell) {
    ws['B3'] = { t: 'n', v: NET_DEBT, f: `Assumptions!B10` };
    ws['C3'] = { t: 's', v: 'From Assumptions; total debt net of cash' };
  }
  // If missingCell: B3 and C3 are left blank — issue 4

  ws['A4'] = { t: 's', v: 'Equity Value' };
  ws['B4'] = { t: 'n', v: equityValue, f: `B2-B3` };
  ws['C4'] = { t: 's', v: 'Enterprise Value minus Net Debt' };

  ws['A5'] = { t: 's', v: 'Shares Outstanding' };
  ws['B5'] = { t: 'n', v: SHARES, f: `Assumptions!B11` };
  ws['C5'] = { t: 's', v: 'Fully diluted; from Assumptions' };

  ws['A6'] = { t: 's', v: 'Implied Share Price' };
  ws['B6'] = { t: 'n', v: Math.round(impliedPrice * 100) / 100, f: `B4/B5` };
  ws['C6'] = { t: 's', v: 'Equity Value ÷ Diluted Shares' };

  // Sensitivity note
  ws['A8'] = { t: 's', v: 'Sensitivity Note' };
  ws['B8'] = { t: 's', v: '+/- 1% WACC changes implied price by approx. $' + (Math.round(impliedPrice * 0.15 * 100) / 100).toString() };

  ws['!ref'] = 'A1:C8';
  return ws;
}

// ---------------------------------------------------------------------------
// Workbook assembler
// ---------------------------------------------------------------------------
function makeWorkbook(
  assumptionsWs: XLSX.WorkSheet,
  revBuildWs: XLSX.WorkSheet,
  dcfWs: XLSX.WorkSheet,
  outputWs: XLSX.WorkSheet,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, assumptionsWs, 'Assumptions');
  XLSX.utils.book_append_sheet(wb, revBuildWs, 'Revenue Build');
  XLSX.utils.book_append_sheet(wb, dcfWs, 'DCF');
  XLSX.utils.book_append_sheet(wb, outputWs, 'Output');
  return wb;
}

// ---------------------------------------------------------------------------
// Build and write the three files
// ---------------------------------------------------------------------------

// 1. pristine_dcf.xlsx — perfect, score 100
{
  const wb = makeWorkbook(
    buildAssumptions(),
    buildRevenueBuild(),
    buildDCF(),
    buildOutput(),
  );
  XLSX.writeFile(wb, join(OUT_DIR, 'pristine_dcf.xlsx'));
  console.log('Written: pristine_dcf.xlsx');
}

// 2. clean_dcf_v1.xlsx — mostly clean, score ~90
// Minor issue: COGS row uses hardcoded 0.38 instead of an Assumptions reference
// (COGS_PCT is not in the Assumptions sheet, so this is acceptable but slightly impure)
// No other issues — this is intentionally "pretty good but not perfect"
{
  const wb = makeWorkbook(
    buildAssumptions(),
    buildRevenueBuild(), // COGS/OpEx formulas already have inline constants (0.38, 0.34)
    buildDCF(),
    buildOutput(),
  );
  XLSX.writeFile(wb, join(OUT_DIR, 'clean_dcf_v1.xlsx'));
  console.log('Written: clean_dcf_v1.xlsx');
}

// 3. messy_dcf_v2.xlsx — all 7 issues baked in
{
  const wb = makeWorkbook(
    buildAssumptions({ undocumentedCell: true }),             // Issue 5: C12 naked number
    buildRevenueBuild({
      hardcodedGrowth: true,    // Issue 1: D3 uses =C3*1.08 instead of Assumptions!B3
      formulaBreak: true,       // Issue 2: D7 uses =D5+D6 instead of =D3*Assumptions!B4
      suspiciousJump: true,     // Issue 6: D3 is 5x Year 2 (hardcoded; overrides hardcodedGrowth on D3)
    }),
    buildDCF({
      circularRef: true,        // Issue 3: D4 references D6 which references D4
      hardcodeRow: true,        // Issue 7: Row 5 (taxes) is all hardcoded numbers
    }),
    buildOutput({ missingCell: true }), // Issue 4: B3 (Net Debt) is blank
  );
  XLSX.writeFile(wb, join(OUT_DIR, 'messy_dcf_v2.xlsx'));
  console.log('Written: messy_dcf_v2.xlsx');
}

// ---------------------------------------------------------------------------
// Sanity check — parse files back and print sheet names + sample cells
// ---------------------------------------------------------------------------
console.log('\n--- Sanity Check ---');
for (const fname of ['pristine_dcf.xlsx', 'clean_dcf_v1.xlsx', 'messy_dcf_v2.xlsx']) {
  const wb = XLSX.readFile(join(OUT_DIR, fname));
  console.log(`\n${fname}`);
  console.log('  Sheets:', wb.SheetNames.join(', '));
  const assWs = wb.Sheets['Assumptions']!;
  const revWs = wb.Sheets['Revenue Build']!;
  const dcfWs = wb.Sheets['DCF']!;
  const outWs = wb.Sheets['Output']!;
  console.log('  Assumptions!B3 (growth):', assWs['B3']?.v);
  console.log('  Revenue Build!B3 (Y1 Rev):', revWs['B3']?.v, '| formula:', revWs['B3']?.f ?? 'NONE');
  console.log('  Revenue Build!D3 (Y3 Rev):', revWs['D3']?.v, '| formula:', revWs['D3']?.f ?? 'HARDCODED');
  console.log('  Revenue Build!D7 (Y3 EBITDA formula):', revWs['D7']?.f ?? 'NONE');
  console.log('  DCF!D4 (NWC formula):', dcfWs['D4']?.f ?? 'NONE');
  console.log('  DCF!D5 (Tax formula):', dcfWs['D5']?.f ?? 'HARDCODED');
  console.log('  Output!B3 (Net Debt):', outWs['B3']?.v ?? 'BLANK');
}
