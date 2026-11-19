import { describe, expect, it } from 'vitest';
import type { DataRow, St } from '../types';
import { applyFilter, buildDataset, groupBy, increasingLevels, summarize } from '../lib/aggregate';

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

describe('buildDataset', () => {
  const d = buildDataset(ROWS);

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
