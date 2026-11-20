import Papa from 'papaparse';
import type { DataRow, RowIssue, St } from '../types';
import { STATUS_LABEL } from '../types';
import { ruleLevel } from './rules';

/** Snapshot columns: the sheet's 9 columns in the agreed order, with normalized values. */
const COLUMNS: [keyof DataRow, string][] = [
  ['empId', 'Emp ID'],
  ['name', 'Name'],
  ['reportingOrg', 'Reporting Orgn'],
  ['band', 'Band'],
  ['hyperscaler', 'HyperScaler'],
  ['eta', 'ETA (Date)'],
  ['status', 'Certificate done/WIP'],
  ['level', 'Certification Levels'],
  ['email', 'Email ID'],
];

export class OldFormatError extends Error {
  constructor() {
    super('This snapshot uses an earlier column format. Move it to local-data/archive-old-format/ and upload the monthly sheet again.');
    this.name = 'OldFormatError';
  }
}

const STATUS_FROM_LABEL: Record<string, St> = { Completed: 'done', 'In progress': 'wip', 'Not started': 'ns' };

export function snapshotToCsv(rows: DataRow[]): string {
  return Papa.unparse({
    fields: COLUMNS.map(([, h]) => h),
    data: rows.map((r) =>
      COLUMNS.map(([k]) => (k === 'level' ? (r.level ? `L${r.level}` : '') : k === 'status' ? STATUS_LABEL[r.status] : r[k])),
    ),
  });
}

export function csvToSnapshot(text: string): DataRow[] {
  if (!text.trim()) return [];
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const fields = parsed.meta.fields ?? [];
  if (!fields.includes('Reporting Orgn') || !fields.includes('Certification Levels') || fields.includes('Added In')) throw new OldFormatError();
  return parsed.data.map((rec) => {
    const get = (h: string) => (rec[h] ?? '').trim();
    const lv = get('Certification Levels');
    return {
      empId: get('Emp ID'),
      name: get('Name'),
      reportingOrg: get('Reporting Orgn'),
      band: get('Band'),
      hyperscaler: get('HyperScaler'),
      eta: get('ETA (Date)'),
      status: STATUS_FROM_LABEL[get('Certificate done/WIP')] ?? 'ns',
      level: lv ? (ruleLevel(lv) ?? 0) : 0,
      email: get('Email ID'),
    };
  });
}

export function issuesToCsv(issues: RowIssue[]): string {
  return Papa.unparse({
    fields: ['Row', 'Emp ID', 'Severity', 'Issue', 'Value'],
    data: issues.map((i) => [i.row, i.empId, i.severity, i.reason, i.value ?? '']),
  });
}

export function toCsv(fields: string[], data: (string | number)[][]): string {
  return Papa.unparse({ fields, data });
}

export function downloadText(fileName: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
