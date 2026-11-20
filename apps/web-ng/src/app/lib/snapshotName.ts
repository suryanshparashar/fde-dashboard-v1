const pad = (n: number) => String(n).padStart(2, '0');
const ID_RE = /^(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;

export const ddmmyy = (d: Date) => `${pad(d.getDate())}${pad(d.getMonth() + 1)}${pad(d.getFullYear() % 100)}`;
export const hhmmss = (d: Date) => `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/** ISO yyyy-mm-dd → local Date at midnight. */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Snapshot id (file name without .csv):
 * {latest date in uploaded sheet ddmmyy}-{today ddmmyy}-{now hhmmss}
 * When the sheet has no valid dates, today is used for the first part.
 */
export function buildSnapshotId(latestSheetDate: string | null, now: Date): string {
  const first = latestSheetDate ? ddmmyy(isoToDate(latestSheetDate)) : ddmmyy(now);
  return `${first}-${ddmmyy(now)}-${hhmmss(now)}`;
}

export function isSnapshotId(id: string): boolean {
  return ID_RE.test(id);
}

export function parseSnapshotId(id: string): { dataUpTo: Date; uploadedAt: Date } | null {
  const m = ID_RE.exec(id);
  if (!m) return null;
  const n = m.slice(1).map(Number);
  return {
    dataUpTo: new Date(2000 + n[2], n[1] - 1, n[0]),
    uploadedAt: new Date(2000 + n[5], n[4] - 1, n[3], n[6], n[7], n[8]),
  };
}

/** Sort key by upload time (yymmddhhmmss), used to order snapshots. */
export function uploadOrderKey(id: string): string {
  const m = ID_RE.exec(id);
  return m ? `${m[6]}${m[5]}${m[4]}${m[7]}${m[8]}${m[9]}` : '';
}
