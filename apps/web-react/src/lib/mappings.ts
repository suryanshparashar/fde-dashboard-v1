import type { St } from '../types';

/**
 * Decisions the uploader made for values the built-in rules don't cover.
 * Saved in local-data/mappings.json and applied automatically to later uploads.
 * Keys: valueKey() of the cell (status/level) or hsKey() (HyperScaler).
 */
export interface Mappings {
  status: Record<string, St | 'skip'>;
  level: Record<string, number | 'skip'>;
  /** HyperScaler spelling → canonical name (an existing one, or itself when kept as new). */
  hyperscaler: Record<string, string>;
}

export const emptyMappings = (): Mappings => ({ status: {}, level: {}, hyperscaler: {} });

export function sanitizeMappings(raw: unknown): Mappings {
  const out = emptyMappings();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof Mappings, Record<string, unknown>>>;
  for (const [k, v] of Object.entries(r.status ?? {})) if (v === 'done' || v === 'wip' || v === 'ns' || v === 'skip') out.status[k] = v;
  for (const [k, v] of Object.entries(r.level ?? {})) if (v === 'skip' || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99)) out.level[k] = v;
  for (const [k, v] of Object.entries(r.hyperscaler ?? {})) if (typeof v === 'string' && v.trim()) out.hyperscaler[k] = v.trim();
  return out;
}

const BASE = '/api/mappings';

export async function fetchMappings(): Promise<Mappings> {
  const res = await fetch(BASE);
  if (res.status === 204) return emptyMappings();
  if (!res.ok) throw new Error(`Could not load saved choices (${res.status})`);
  return sanitizeMappings(await res.json());
}

export async function saveMappings(m: Mappings): Promise<void> {
  const res = await fetch(BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m, null, 2) });
  if (!res.ok) throw new Error(`Could not save your choices (${res.status})`);
}
