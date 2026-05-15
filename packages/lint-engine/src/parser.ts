import * as XLSX from 'xlsx';
import type {
  CellData,
  CellType,
  CellValue,
  ParsedSheet,
  ParsedWorkbook,
} from './types.js';

export interface ParseOptions {
  fileName?: string;
}

type SupportedInput = ArrayBuffer | Uint8Array;

function toUint8(input: SupportedInput): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  // Buffer is a Uint8Array under the hood; this branch handles unusual host types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyInput = input as any;
  if (anyInput && typeof anyInput.byteLength === 'number' && anyInput.buffer) {
    return new Uint8Array(anyInput.buffer, anyInput.byteOffset ?? 0, anyInput.byteLength);
  }
  throw new TypeError('parseWorkbook expects an ArrayBuffer or Uint8Array');
}

function mapCellType(rawType: string | undefined, hasFormula: boolean): CellType {
  if (hasFormula) return 'formula';
  switch (rawType) {
    case 'n':
      return 'number';
    case 's':
    case 'str':
      return 'text';
    case 'b':
      return 'boolean';
    default:
      return 'empty';
  }
}

function normalizeValue(raw: unknown, type: CellType): CellValue {
  if (raw === undefined || raw === null) return null;
  if (type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'boolean') {
    return Boolean(raw);
  }
  if (type === 'text') {
    return String(raw);
  }
  if (type === 'formula') {
    // value carried alongside formula — keep as-is when scalar
    if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') {
      return raw;
    }
    return null;
  }
  return null;
}

function emptyCell(row: number, col: number): CellData {
  return {
    address: XLSX.utils.encode_cell({ r: row, c: col }),
    row,
    col,
    value: null,
    formula: null,
    type: 'empty',
  };
}

export function parseWorkbook(
  input: SupportedInput,
  opts: ParseOptions = {},
): ParsedWorkbook {
  const data = toUint8(input);
  const wb = XLSX.read(data, {
    type: 'array',
    cellFormula: true,
    cellNF: true,
    cellDates: true,
  });

  const sheets: ParsedSheet[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const ref = ws['!ref'];
    if (!ref) {
      sheets.push({ name: sheetName, cells: [], rowCount: 0, colCount: 0 });
      continue;
    }
    const range = XLSX.utils.decode_range(ref);
    const rowCount = range.e.r + 1;
    const colCount = range.e.c + 1;

    const grid: CellData[][] = [];
    for (let r = 0; r < rowCount; r++) {
      const rowArr: CellData[] = [];
      for (let c = 0; c < colCount; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cell: any = (ws as any)[address];
        if (!cell) {
          rowArr.push(emptyCell(r, c));
          continue;
        }
        const formulaRaw: string | undefined =
          typeof cell.f === 'string' && cell.f.length > 0 ? cell.f : undefined;
        const hasFormula = Boolean(formulaRaw);
        const type = mapCellType(cell.t, hasFormula);
        const value = normalizeValue(cell.v, type);
        rowArr.push({
          address,
          row: r,
          col: c,
          value,
          formula: hasFormula
            ? formulaRaw!.startsWith('=')
              ? formulaRaw!.slice(1)
              : formulaRaw!
            : null,
          type,
        });
      }
      grid.push(rowArr);
    }

    sheets.push({ name: sheetName, cells: grid, rowCount, colCount });
  }

  return {
    sheets,
    sheetNames: wb.SheetNames.slice(),
    fileName: opts.fileName,
  };
}
