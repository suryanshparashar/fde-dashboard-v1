import { isoToDate, parseSnapshotId } from './snapshotName';

export const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDateTime = (d: Date) =>
  `${fmtDate(d)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
export const fmtIso = (iso: string) => (iso ? fmtDate(isoToDate(iso)) : '—');
export const fmtNum = (n: number) => n.toLocaleString('en-IN');
/** "30 Dec" (with year only when not the current year). */
export const fmtShort = (iso: string) => {
  if (!iso) return '—';
  const d = isoToDate(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: '2-digit' } : {}) });
};

/** Today as local ISO yyyy-mm-dd. */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** "18 Nov 2026, 10:42" for a snapshot id. */
export function snapshotLabel(id: string): string {
  const p = parseSnapshotId(id);
  return p ? fmtDateTime(p.uploadedAt) : id;
}
export function snapshotUploadDate(id: string): string {
  const p = parseSnapshotId(id);
  return p ? fmtDate(p.uploadedAt) : '—';
}

/** "Nov 2026": the data month of a snapshot (= the month it was uploaded). */
export function dataMonth(id: string): string {
  const p = parseSnapshotId(id);
  return p ? p.uploadedAt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';
}
export const monthOf = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
