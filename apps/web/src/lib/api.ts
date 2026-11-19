import type { DataRow, SnapshotInfo } from '../types';
import { csvToSnapshot } from './csv';
import { parseSnapshotId } from './snapshotName';

/**
 * Talks to the local-data dev-server plugin (vite-plugin-local-data.ts).
 * The future backend will serve the same endpoints.
 */
const BASE = '/api/snapshots';

interface RawSnapshotInfo {
  name: string;
  sizeBytes: number;
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`Could not list snapshots (${res.status})`);
  const raw = (await res.json()) as RawSnapshotInfo[];
  return raw.flatMap((r) => {
    const id = r.name.replace(/\.csv$/, '');
    const p = parseSnapshotId(id);
    return p ? [{ id, ...p, sizeBytes: r.sizeBytes }] : [];
  });
}

export interface LoadedSnapshot {
  id: string | null;
  rows: DataRow[];
}

/** id = 'latest' or a snapshot id. Returns { id: null, rows: [] } when nothing was uploaded yet. */
export async function fetchSnapshot(id: string): Promise<LoadedSnapshot> {
  const res = await fetch(`${BASE}/${id === 'latest' ? 'latest' : `${id}.csv`}`);
  if (res.status === 204) return { id: null, rows: [] };
  if (!res.ok) throw new Error(res.status === 404 ? `Snapshot ${id} not found` : `Could not load data (${res.status})`);
  const name = res.headers.get('X-Snapshot-Name');
  return { id: name ? name.replace(/\.csv$/, '') : id, rows: csvToSnapshot(await res.text()) };
}

export async function fetchSnapshotText(id: string): Promise<string> {
  const res = await fetch(`${BASE}/${id}.csv`);
  if (!res.ok) throw new Error(`Could not load ${id}`);
  return res.text();
}

/** Writes a new snapshot. Returns 'exists' when that name is taken (the caller picks a new name). */
export async function saveSnapshot(id: string, content: string): Promise<'saved' | 'exists'> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${id}.csv`, content }),
  });
  if (res.status === 201) return 'saved';
  if (res.status === 409) return 'exists';
  const err = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(err.error ?? `Save failed (${res.status})`);
}
