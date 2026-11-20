import { describe, expect, it } from 'vitest';
import type { DataRow, St } from '../types';
import { applyFilter, buildDataset, groupBy, increasingLevels, summarize } from '../lib/aggregate';
import { DEFAULT_LEVELS, levelsFor, type LevelConfig } from '../lib/levelConfig';

const row = (empId: string, hyperscaler: string, level: number, status: St, extra: Partial<DataRow> = {}): DataRow => ({
  empId,
  name: `Name ${empId}`,
  reportingOrg: 'Data & AI',
  band: 'B2',
  hyperscaler,
  eta: '',
  status,
  level,
  email: `${empId.toLowerCase()}@example.com`,
  ...extra,
});

// 7 employees, 8 enrollments, N = 3
const ROWS: DataRow[] = [
  row('A', 'Anthropic', 1, 'done'),
  row('A', 'Anthropic', 2, 'wip', { eta: '2027-01-15' }),
  row('A', 'Anthropic', 3, 'ns'),
  row('A', 'AWS', 1, 'done', { reportingOrg: 'Consulting' }), // different org on another row → flagged
  row('A', 'AWS', 2, 'done'),
  row('A', 'AWS', 3, 'done'),
  row('B', 'Anthropic', 1, 'done'), // L2, L3 have no row → Not started
  row('C', 'Azure', 1, 'wip'),
  row('D', 'Google', 1, 'ns', { reportingOrg: '', band: '' }),
  row('E', 'Azure', 1, 'wip'),
  row('E', 'Azure', 2, 'done'), // L2 completed while L1 isn't → skipped level
  row('F', 'AWS', 1, 'wip'),
  row('F', 'AWS', 1, 'done', { eta: '2026-11-02' }), // duplicate → furthest (Completed) kept
  row('G', 'AWS', 0, 'done'), // empty level → enrollment only
];

// This small example is written for 3 levels, so it runs with a 3-level config.
const THREE: LevelConfig = { default: 3, byHyperscaler: {} };

describe('level config (src/lib/levelConfig.ts)', () => {
  it('every HyperScaler has 4 levels by default, regardless of the levels in the file', () => {
    expect(DEFAULT_LEVELS).toBe(4);
    expect(levelsFor('AWS')).toBe(4);
    expect(levelsFor('Oracle Cloud')).toBe(4);
    const d = buildDataset([row('X', 'AWS', 1, 'done'), row('Y', 'Azure', 2, 'wip')]);
    expect(d.N).toBe(4);
    expect(d.enrollments.every((e) => e.levels.length === 4)).toBe(true);
    for (const l of d.summary.levels) expect(l.done + l.wip + l.ns).toBe(2);
  });

  it('Completed means the HyperScaler’s own top level (L4) is done', () => {
    const three = [1, 2, 3].map((lv) => row('X', 'AWS', lv, 'done'));
    expect(buildDataset(three).enrollments[0].status).toBe('wip');
    expect(buildDataset([...three, row('X', 'AWS', 4, 'done')]).enrollments[0].status).toBe('done');
  });

  it('a per-HyperScaler override changes only that HyperScaler', () => {
    const cfg: LevelConfig = { default: 4, byHyperscaler: { Azure: 3 } };
    const rows = [1, 2, 3].flatMap((lv) => [row('X', 'Azure', lv, 'done'), row('Y', 'AWS', lv, 'done')]);
    const d = buildDataset(rows, cfg);
    const az = d.enrollments.find((e) => e.hyperscaler === 'Azure')!;
    const aws = d.enrollments.find((e) => e.hyperscaler === 'AWS')!;
    expect(az.levels).toHaveLength(3);
    expect(az.status).toBe('done'); // L3 is Azure's top level
    expect(aws.levels).toHaveLength(4);
    expect(aws.status).toBe('wip');
    expect(d.N).toBe(4);
    // L4 counts only enrollments whose HyperScaler has an L4 (AWS), L1–L3 count both
    expect(d.summary.levels.map((l) => l.done + l.wip + l.ns)).toEqual([2, 2, 2, 1]);
  });

  it('rows above the HyperScaler’s levels are flagged and not counted', () => {
    const d = buildDataset([row('X', 'AWS', 1, 'done'), row('X', 'AWS', 5, 'done'), row('X', 'AWS', 6, 'wip')]);
    const e = d.enrollments[0];
    expect(e.levels).toEqual(['done', 'ns', 'ns', 'ns']);
    expect(e.highest).toBe(1);
    expect(e.overRows).toBe(2);
    expect(d.quality.overRows).toBe(2);
    expect(d.quality.overEnrollments).toBe(1);
    expect(applyFilter(d.enrollments, { flag: 'over' }).map((x) => x.empId)).toEqual(['X']);
  });
});

describe('buildDataset', () => {
  const d = buildDataset(ROWS, THREE);

  it('counts unique employees and enrollments separately', () => {
    expect(d.N).toBe(3);
    expect(d.summary.employees).toBe(7);
    expect(d.summary.total).toBe(8);
    expect(d.rowCount).toBe(14);
  });

  it('every level has the same total (missing level rows = Not started)', () => {
    for (const l of d.summary.levels) expect(l.done + l.wip + l.ns).toBe(8);
    expect(d.summary.levels).toEqual([
      { done: 4, wip: 2, ns: 2 },
      { done: 2, wip: 1, ns: 5 },
      { done: 1, wip: 0, ns: 7 },
    ]);
  });

  it('enrollment status: Completed = top level done, In progress = anything started', () => {
    expect(d.summary.s).toEqual({ done: 1, wip: 5, ns: 2 });
    expect(d.summary.started).toBe(6);
  });

  it('highest level completed', () => {
    expect(d.summary.highest).toEqual({ none: 3, byLevel: [3, 1, 1] });
    expect(d.summary.reached).toBe(5);
  });

  it('resolves duplicates to the furthest status and flags them', () => {
    const f = d.enrollments.find((e) => e.empId === 'F')!;
    expect(f.levels[0]).toBe('done');
    expect(f.etas[0]).toBe('2026-11-02');
    expect(f.dupLevels).toEqual([1]);
    expect(d.quality.duplicateRows).toBe(1);
    expect(d.quality.duplicateEnrollments).toBe(1);
  });

  it('flags skipped levels, empty level cells, profile conflicts and missing org/band', () => {
    expect(d.quality.skipped).toBe(1);
    expect(d.enrollments.find((e) => e.empId === 'E')!.skipped).toBe(true);
    expect(d.quality.emptyLevelRows).toBe(1);
    expect(d.quality.profileConflicts).toEqual([{ empId: 'A', field: 'Reporting Orgn', values: ['Data & AI', 'Consulting'] }]);
    expect(d.quality.noOrg).toBe(1);
    expect(d.quality.noBand).toBe(1);
    expect(d.quality.increasing).toEqual([]);
    expect(d.quality.addedHyperscalers).toEqual([]);
  });

  it('groups by HyperScaler, Org and Band', () => {
    const hs = groupBy(d.enrollments, 'hyperscaler');
    expect(hs.map((g) => [g.name, g.total])).toEqual([['AWS', 3], ['Anthropic', 2], ['Azure', 2], ['Google', 1]]);
    const org = groupBy(d.enrollments, 'reportingOrg');
    expect(org[org.length - 1].name).toBe(''); // "Not given" always last
    expect(d.hyperscalers).toEqual(['Anthropic', 'Azure', 'AWS', 'Google']);
  });

  it('filters the employee list', () => {
    expect(applyFilter(d.enrollments, { lv: 2, ls: 'done' }).map((e) => e.key).sort()).toEqual(['A|AWS', 'E|Azure']);
    expect(applyFilter(d.enrollments, { hi: 0 })).toHaveLength(3);
    expect(applyFilter(d.enrollments, { flag: 'skip' }).map((e) => e.empId)).toEqual(['E']);
    expect(applyFilter(d.enrollments, { org: '' }).map((e) => e.empId)).toEqual(['D']);
    expect(applyFilter(d.enrollments, { hs: 'AWS', st: 'done' }).map((e) => e.empId)).toEqual(['A']);
    expect(applyFilter(d.enrollments, { q: 'f@example' }).map((e) => e.empId)).toEqual(['F']);
  });

  it('detects completed counts that go up between levels', () => {
    const odd = buildDataset([row('X', 'AWS', 2, 'done'), row('Y', 'AWS', 2, 'done'), row('Z', 'AWS', 1, 'done')]);
    expect(increasingLevels(summarize(odd.enrollments, odd.N))).toEqual([2]);
    expect(odd.quality.increasing).toEqual([2]);
  });

  it('handles an empty file', () => {
    const e = buildDataset([]);
    expect(e.N).toBe(0);
    expect(e.summary.total).toBe(0);
    expect(e.hyperscalers).toEqual([]);
  });
});
