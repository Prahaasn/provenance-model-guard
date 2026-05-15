import * as XLSX from 'xlsx';

export type SheetSpec = {
  name: string;
  rows: (string | number | boolean | null | { f: string; v?: number | string | boolean })[][];
};

export function buildWorkbookBuffer(sheets: SheetSpec[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const spec of sheets) {
    // Convert any formula objects to placeholder values, then post-process the sheet.
    const aoa = spec.rows.map((row) =>
      row.map((cell) => {
        if (cell !== null && typeof cell === 'object' && 'f' in cell) {
          return cell.v ?? 0;
        }
        return cell;
      }),
    );
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Patch in formulas
    for (let r = 0; r < spec.rows.length; r++) {
      const row = spec.rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell !== null && typeof cell === 'object' && 'f' in cell) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const formula = cell.f.startsWith('=') ? cell.f.slice(1) : cell.f;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wsAny = ws as any;
          wsAny[addr] = {
            t: typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's',
            v: cell.v ?? 0,
            f: formula,
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, spec.name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellFormula: true });
  // XLSX.write with type 'array' returns an ArrayBuffer-like (often Uint8Array). Normalize.
  if (out instanceof ArrayBuffer) return out;
  if (out instanceof Uint8Array) {
    const ab = new ArrayBuffer(out.byteLength);
    new Uint8Array(ab).set(out);
    return ab;
  }
  // Fallback: assume array of bytes
  const arr = out as unknown as number[];
  const ab = new ArrayBuffer(arr.length);
  new Uint8Array(ab).set(arr);
  return ab;
}
