import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** Data rows (cells as read: string | number | boolean). */
  rows: unknown[][];
  /** The same rows as Excel displays them (e.g. 0.4 formatted as "40%"). */
  display: string[][];
  /** 1-based spreadsheet row number of each data row. */
  rowNumbers: number[];
  headerRowNumber: number;
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
  date1904: boolean;
}

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xls', '.xlsb', '.ods', '.csv', '.tsv', '.txt'];

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/**
 * Read any spreadsheet format SheetJS supports.
 * raw:true keeps CSV text as-is, so "01-10-2026" is not guessed as a US date.
 * The app parses those dates itself, day-first.
 */
export function readWorkbook(data: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(data, { type: 'array', raw: true, cellDates: false, dense: true });
  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);
  const sheets: ParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '', blankrows: true });
    const shown = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: true });
    // Header = first row with at least 3 filled cells (skips title rows above the table).
    const headerIdx = grid.findIndex((r) => r.filter((c) => !isBlank(c)).length >= 3);
    if (headerIdx < 0) continue;
    const headers = grid[headerIdx].map((h) => String(h ?? '').trim());
    const rows: unknown[][] = [];
    const rowNumbers: number[] = [];
    const display: string[][] = [];
    for (let i = headerIdx + 1; i < grid.length; i++) {
      if (grid[i].every(isBlank)) continue;
      rows.push(grid[i]);
      display.push((shown[i] ?? []).map((c) => String(c ?? '')));
      rowNumbers.push(i + 1);
    }
    sheets.push({ name, headers, rows, display, rowNumbers, headerRowNumber: headerIdx + 1 });
  }
  return { sheets, date1904 };
}

export function defaultSheetIndex(wb: ParsedWorkbook): number {
  const idx = wb.sheets.findIndex((s) => s.rows.length > 0);
  return idx < 0 ? 0 : idx;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function monthOf(word: string): number | undefined {
  const w = word.toLowerCase();
  return MONTHS[w.slice(0, 4)] ?? MONTHS[w.slice(0, 3)];
}

const pad = (n: number) => String(n).padStart(2, '0');

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Convert a cell to ISO yyyy-mm-dd. Handles Excel serial numbers, ISO strings,
 * day-first numeric dates (dd-mm-yyyy, dd/mm/yy), and month names ("1 Oct 2026", "Oct 1, 2026",
 * "Wednesday, November 18, 2026").
 * Ambiguous numeric dates are read day-first; if the 2nd part is > 12, month-first.
 */
export function toIsoDate(value: unknown, date1904 = false): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return iso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 1 || value > 2958465) return null;
    const p = XLSX.SSF.parse_date_code(value, { date1904 });
    return p ? iso(p.y, p.m, p.d) : null;
  }
  // "Wednesday, November 18, 2026" → "November 18, 2026"
  const s = String(value ?? '')
    .trim()
    .replace(/^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, '');
  if (!s) return null;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/.exec(s);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    return b > 12 && a <= 12 ? iso(y, a, b) : iso(y, b, a);
  }

  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})[\s\-/.,]+(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mon = monthOf(m[2]);
    if (mon) return iso(+m[3], mon, +m[1]);
  }

  m = /^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?[\s,\-/.]+(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mon = monthOf(m[1]);
    if (mon) return iso(+m[3], mon, +m[2]);
  }

  // A numeric string that is really an Excel serial (e.g. from a CSV export).
  if (/^\d{5}(\.\d+)?$/.test(s)) return toIsoDate(Number(s), date1904);
  return null;
}
