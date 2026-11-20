import type { St } from '../types';

/**
 * Status and level rules agreed with the data owner.
 *
 * Status ("Certificate done/WIP"):
 *   empty                      → Not started
 *   WIP, In progress, "40%"    → In progress
 *   Completed, YES, Done       → Completed
 *   anything else              → the uploader decides (remembered in mappings.json)
 *
 * Level ("Certification Levels"): L1, Level 1, Level-2, Level_3, level 4 … → 1, 2, 3, 4 …
 *   anything else              → the uploader decides (remembered)
 */

/** Key used to remember an uploader's decision for a cell value: lower-case, single spaces. */
export const valueKey = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const DONE = new Set(['completed', 'done', 'yes']);
const WIP = new Set(['wip', 'inprogress']);
const NOT_STARTED = new Set(['notstarted']);

/** Built-in rule only. Returns null when the uploader has to decide. */
export function ruleStatus(text: string): St | null {
  const t = text.trim();
  if (!t) return 'ns';
  if (/^\d+(\.\d+)?\s*%$/.test(t)) return 'wip';
  const k = t.toLowerCase().replace(/[^a-z]/g, '');
  if (DONE.has(k)) return 'done';
  if (WIP.has(k)) return 'wip';
  if (NOT_STARTED.has(k)) return 'ns';
  return null;
}

/** Built-in rule only: "L1", "Level 2", "Level-3", "level_4" → number. null when the uploader has to decide. */
export function ruleLevel(text: string): number | null {
  const m = /^(?:l|level)[\s\-_.]*([1-9]\d?)$/.exec(text.trim().toLowerCase());
  return m ? Number(m[1]) : null;
}
