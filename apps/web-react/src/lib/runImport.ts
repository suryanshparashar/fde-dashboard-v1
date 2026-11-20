import type { DataRow } from '../types';
import { saveSnapshot } from './api';
import { snapshotToCsv } from './csv';
import { buildSnapshotId } from './snapshotName';

/**
 * Save one month's upload as its own snapshot (each file = one month; nothing is merged).
 * The file name's first part is the latest completion date in the sheet.
 */
export async function runImport(rows: DataRow[], latestDoneDate: string | null): Promise<string> {
  const csv = snapshotToCsv(rows);
  const start = Date.now();
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = buildSnapshotId(latestDoneDate, new Date(start + attempt * 1000));
    if ((await saveSnapshot(id, csv)) === 'saved') return id;
  }
  throw new Error('Could not find a free snapshot file name. Please try again.');
}
