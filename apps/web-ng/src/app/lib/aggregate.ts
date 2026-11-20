import type { DataRow, St } from '../types';
import { isKnownHyperscaler, sortHyperscalers } from './hyperscalers';
import { LEVEL_CONFIG, levelsFor, type LevelConfig } from './levelConfig';

/**
 * Aggregation of one month's rows.
 *
 * Enrollment = one employee × one HyperScaler. Each HyperScaler has a fixed number of levels
 * (src/lib/levelConfig.ts: 4 for all of them now). Its status per level comes from that level's row;
 * a level with no row counts as Not started. A row above the HyperScaler's levels is flagged, not counted.
 *
 * Enrollment status: Completed = its HyperScaler's top level completed; In progress = any level
 * In progress or Completed but not the top one; Not started = nothing started.
 */

export interface Counts {
  done: number;
  wip: number;
  ns: number;
}

export interface Enrollment {
  key: string;
  empId: string;
  name: string;
  email: string;
  reportingOrg: string;
  band: string;
  hyperscaler: string;
  /** Status per level, index 0 = L1. Length = levels of its HyperScaler (src/lib/levelConfig.ts). */
  levels: St[];
  /** ETA per level ('' when none). */
  etas: string[];
  status: St;
  /** Highest completed level, 0 = none. */
  highest: number;
  /** Latest ETA across its rows. */
  latestEta: string;
  /** Levels that had more than one row in the file. */
  dupLevels: number[];
  /** Extra rows beyond the first for the same level. */
  dupRows: number;
  /** A level is completed while a lower level is not. */
  skipped: boolean;
  /** Rows of this enrollment with an empty level cell. */
  emptyLevelRows: number;
  /** Rows above its HyperScaler's level count (e.g. L5 when it has 4): not counted. */
  overRows: number;
}

export interface Summary {
  /** Enrollments (employee × HyperScaler). */
  total: number;
  /** Unique employees. */
  employees: number;
  s: Counts;
  started: number;
  /** Per level, index 0 = L1. A level counts the enrollments whose HyperScaler has that level (all of them while every HyperScaler has the same count). */
  levels: Counts[];
  highest: { none: number; byLevel: number[] };
  /** Enrollments that completed at least one level. */
  reached: number;
}

export interface GroupRow {
  name: string;
  total: number;
  employees: number;
  s: Counts;
}

export interface ProfileConflict {
  empId: string;
  field: 'Name' | 'Reporting Orgn' | 'Band' | 'Email ID';
  values: string[];
}

export interface Quality {
  /** Rows that repeat an employee × HyperScaler × level already in the file (furthest status kept). */
  duplicateRows: number;
  duplicateEnrollments: number;
  /** Enrollments with a completed level above a level that isn't completed. */
  skipped: number;
  /** Levels whose completed count is higher than the level below (L1 ≥ L2 ≥ … expected). */
  increasing: number[];
  emptyLevelRows: number;
  /** Rows above their HyperScaler's level count (not counted) and the enrollments they belong to. */
  overRows: number;
  overEnrollments: number;
  profileConflicts: ProfileConflict[];
  noOrg: number;
  noBand: number;
  noEmail: number;
  /** HyperScalers in the data that are not one of the 7 known ones (added automatically from a file). */
  addedHyperscalers: string[];
}

export interface Dataset {
  /** Most levels any HyperScaler with data has (from src/lib/levelConfig.ts); 0 when there is no data. */
  N: number;
  rowCount: number;
  enrollments: Enrollment[];
  hyperscalers: string[];
  summary: Summary;
  quality: Quality;
}

const RANK: Record<St, number> = { ns: 0, wip: 1, done: 2 };
export const empKey = (empId: string) => empId.trim().toUpperCase();

export function buildDataset(rows: DataRow[], levelCfg: LevelConfig = LEVEL_CONFIG): Dataset {

  // Profile per employee: first non-empty value; differing values are flagged.
  const profiles = new Map<string, { empId: string; name: string; email: string; reportingOrg: string; band: string; seen: Record<string, Set<string>> }>();
  for (const r of rows) {
    const k = empKey(r.empId);
    let p = profiles.get(k);
    if (!p) profiles.set(k, (p = { empId: r.empId, name: '', email: '', reportingOrg: '', band: '', seen: { Name: new Set(), 'Reporting Orgn': new Set(), Band: new Set(), 'Email ID': new Set() } }));
    const fill = (f: 'name' | 'email' | 'reportingOrg' | 'band', label: string) => {
      const v = r[f].trim();
      if (!v) return;
      p![f] ||= v;
      p!.seen[label].add(label === 'Email ID' ? v.toLowerCase() : v);
    };
    fill('name', 'Name');
    fill('reportingOrg', 'Reporting Orgn');
    fill('band', 'Band');
    fill('email', 'Email ID');
  }

  const byKey = new Map<string, Enrollment & { _rows: number[] }>();
  for (const r of rows) {
    const ek = empKey(r.empId);
    const key = `${ek}|${r.hyperscaler}`;
    let e = byKey.get(key);
    if (!e) {
      const p = profiles.get(ek)!;
      const n = levelsFor(r.hyperscaler, levelCfg);
      e = {
        key,
        empId: p.empId,
        name: p.name,
        email: p.email,
        reportingOrg: p.reportingOrg,
        band: p.band,
        hyperscaler: r.hyperscaler,
        levels: Array<St>(n).fill('ns'),
        etas: Array<string>(n).fill(''),
        status: 'ns',
        highest: 0,
        latestEta: '',
        dupLevels: [],
        dupRows: 0,
        skipped: false,
        emptyLevelRows: 0,
        overRows: 0,
        _rows: Array<number>(n).fill(0),
      };
      byKey.set(key, e);
    }
    if (r.eta && r.eta > e.latestEta) e.latestEta = r.eta;
    if (!r.level) {
      e.emptyLevelRows++;
      continue;
    }
    if (r.level > e.levels.length) {
      e.overRows++; // above this HyperScaler's levels: flagged, not counted
      continue;
    }
    const i = r.level - 1;
    e._rows[i]++;
    if (e._rows[i] > 1) {
      e.dupRows++;
      if (!e.dupLevels.includes(r.level)) e.dupLevels.push(r.level);
    }
    // Furthest status wins; on a tie keep a non-empty ETA.
    if (e._rows[i] === 1 || RANK[r.status] > RANK[e.levels[i]] || (RANK[r.status] === RANK[e.levels[i]] && !e.etas[i] && r.eta)) {
      e.levels[i] = r.status;
      e.etas[i] = r.eta;
    }
  }

  const enrollments: Enrollment[] = [];
  for (const { _rows, ...e } of byKey.values()) {
    void _rows;
    const lastDone = e.levels.lastIndexOf('done');
    e.highest = lastDone + 1;
    e.skipped = lastDone > 0 && e.levels.slice(0, lastDone).some((s) => s !== 'done');
    const top = e.levels.length;
    e.status = top > 0 && e.levels[top - 1] === 'done' ? 'done' : e.levels.some((s) => s !== 'ns') ? 'wip' : 'ns';
    enrollments.push(e);
  }

  const N = enrollments.reduce((m, e) => Math.max(m, e.levels.length), 0);
  const summary = summarize(enrollments, N);
  const conflicts: ProfileConflict[] = [];
  for (const p of profiles.values())
    for (const [field, set] of Object.entries(p.seen)) if (set.size > 1) conflicts.push({ empId: p.empId, field: field as ProfileConflict['field'], values: [...set] });
  const hyperscalers = sortHyperscalers(enrollments.map((e) => e.hyperscaler));

  return {
    N,
    rowCount: rows.length,
    enrollments,
    hyperscalers,
    summary,
    quality: { ...subsetQuality(enrollments, summary, conflicts), addedHyperscalers: hyperscalers.filter((h) => !isKnownHyperscaler(h)) },
  };
}

/** Data checks for a set of enrollments (the whole file, or one HyperScaler). */
export function subsetQuality(list: Enrollment[], sum: Summary, allConflicts: ProfileConflict[]): Quality {
  const emps = new Map<string, Enrollment>();
  for (const e of list) if (!emps.has(empKey(e.empId))) emps.set(empKey(e.empId), e);
  const people = [...emps.values()];
  return {
    duplicateRows: list.reduce((n, e) => n + e.dupRows, 0),
    duplicateEnrollments: list.filter((e) => e.dupRows > 0).length,
    skipped: list.filter((e) => e.skipped).length,
    increasing: increasingLevels(sum),
    emptyLevelRows: list.reduce((n, e) => n + e.emptyLevelRows, 0),
    overRows: list.reduce((n, e) => n + e.overRows, 0),
    overEnrollments: list.filter((e) => e.overRows > 0).length,
    profileConflicts: allConflicts.filter((c) => emps.has(empKey(c.empId))),
    noOrg: people.filter((p) => !p.reportingOrg).length,
    noBand: people.filter((p) => !p.band).length,
    noEmail: people.filter((p) => !p.email).length,
    addedHyperscalers: [],
  };
}

export function summarize(list: Enrollment[], N: number): Summary {
  const s: Counts = { done: 0, wip: 0, ns: 0 };
  const levels: Counts[] = Array.from({ length: N }, () => ({ done: 0, wip: 0, ns: 0 }));
  const byLevel = Array<number>(N).fill(0);
  const emps = new Set<string>();
  let none = 0;
  for (const e of list) {
    s[e.status]++;
    emps.add(empKey(e.empId));
    e.levels.forEach((st, i) => levels[i] && levels[i][st]++); // a level counts only enrollments whose HyperScaler has it
    if (e.highest) byLevel[e.highest - 1]++;
    else none++;
  }
  return {
    total: list.length,
    employees: emps.size,
    s,
    started: s.done + s.wip,
    levels,
    highest: { none, byLevel },
    reached: list.length - none,
  };
}

/** Levels (1-based) whose completed count is above the level below it. */
export function increasingLevels(sum: Summary): number[] {
  const out: number[] = [];
  for (let i = 1; i < sum.levels.length; i++) if (sum.levels[i].done > sum.levels[i - 1].done) out.push(i + 1);
  return out;
}

export type GroupField = 'hyperscaler' | 'reportingOrg' | 'band';

/** Rows per group value, biggest first ('' = not given, always last). */
export function groupBy(list: Enrollment[], field: GroupField): GroupRow[] {
  const map = new Map<string, { s: Counts; emps: Set<string>; total: number }>();
  for (const e of list) {
    const k = e[field];
    let g = map.get(k);
    if (!g) map.set(k, (g = { s: { done: 0, wip: 0, ns: 0 }, emps: new Set(), total: 0 }));
    g.total++;
    g.s[e.status]++;
    g.emps.add(empKey(e.empId));
  }
  return [...map.entries()]
    .map(([name, g]) => ({ name, total: g.total, employees: g.emps.size, s: g.s }))
    .sort((a, b) => (a.name === '' ? 1 : 0) - (b.name === '' ? 1 : 0) || b.total - a.total || a.name.localeCompare(b.name));
}

/** Filters for the employee list; all optional. `org: ''` means "Reporting Orgn not given". */
export interface PeopleFilter {
  hs?: string;
  org?: string;
  band?: string;
  /** Enrollment status. */
  st?: St;
  /** Level (1-based) … */
  lv?: number;
  /** … and its status on that level. */
  ls?: St;
  /** Highest completed level (0 = none). */
  hi?: number;
  flag?: 'skip' | 'dup' | 'nolevel' | 'over';
  q?: string;
}

export function applyFilter(list: Enrollment[], f: PeopleFilter): Enrollment[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter(
    (e) =>
      (f.hs === undefined || e.hyperscaler === f.hs) &&
      (f.org === undefined || e.reportingOrg === f.org) &&
      (f.band === undefined || e.band === f.band) &&
      (f.st === undefined || e.status === f.st) &&
      (f.lv === undefined || f.ls === undefined || e.levels[f.lv - 1] === f.ls) &&
      (f.hi === undefined || e.highest === f.hi) &&
      (f.flag === undefined || (f.flag === 'skip' ? e.skipped : f.flag === 'dup' ? e.dupLevels.length > 0 : f.flag === 'over' ? e.overRows > 0 : e.emptyLevelRows > 0)) &&
      (!q || `${e.empId} ${e.name} ${e.email} ${e.reportingOrg} ${e.band} ${e.hyperscaler}`.toLowerCase().includes(q)),
  );
}

export const pct = (v: number, t: number, d = 1) => (t ? ((v / t) * 100).toFixed(d) : (0).toFixed(d));
