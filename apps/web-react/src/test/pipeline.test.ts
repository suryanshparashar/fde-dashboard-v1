import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readWorkbook, defaultSheetIndex } from '../lib/parse';
import { autoMapColumns } from '../lib/columns';
import { validateRows } from '../lib/validate';
import { emptyMappings, sanitizeMappings } from '../lib/mappings';
import { buildDataset } from '../lib/aggregate';
import { csvToSnapshot, OldFormatError, snapshotToCsv } from '../lib/csv';

// Built by `node scripts/make-fde-sample.mjs src/test/fixtures/fde-sample.xlsx` (deterministic; local-data/test/ is yours to edit).
const FILE = path.resolve(__dirname, 'fixtures/fde-sample.xlsx');
const TODAY = '2026-11-18';

function load() {
  const buf = fs.readFileSync(FILE);
  const wb = readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const sheet = wb.sheets[defaultSheetIndex(wb)];
  return { wb, sheet, mapping: autoMapColumns(sheet.headers) };
}

describe('sample monthly file → dashboard data', () => {
  const { wb, sheet, mapping } = load();

  it('stops on values the rules do not cover and flags the new HyperScaler', () => {
    const v = validateRows(sheet, mapping, emptyMappings(), wb.date1904, TODAY);
    expect(v.unknownStatus.map((u) => [u.raw, u.count])).toEqual([['Certified', 2]]);
    expect(v.unknownLevel.map((u) => [u.raw, u.count])).toEqual([['Foundation', 1]]);
    expect(v.newHyperscalers.map((h) => [h.name, h.count])).toEqual([['Oracle Cloud', 3]]);
    expect(v.issues.filter((i) => i.severity === 'error').map((i) => i.reason)).toEqual(['Missing Emp ID (row skipped)']);
    // rows waiting for a decision are not ready yet
    expect(v.rows).toHaveLength(sheet.rows.length - 1 - 3);
  });

  const mappings = sanitizeMappings({ status: { certified: 'done' }, level: { foundation: 1 }, hyperscaler: { oraclecloud: 'Oracle Cloud' } });
  const v = validateRows(sheet, mapping, mappings, wb.date1904, TODAY);
  const d = buildDataset(v.rows);

  it('applies remembered choices on the next upload', () => {
    expect(v.unknownStatus).toEqual([]);
    expect(v.unknownLevel).toEqual([]);
    expect(v.newHyperscalers).toEqual([]); // remembered → no longer flagged on upload
    expect(v.rows).toHaveLength(sheet.rows.length - 1);
  });

  it('groups HyperScaler spellings into the known ones plus the added one', () => {
    expect(d.hyperscalers).toEqual(['Anthropic', 'Azure', 'AWS', 'Google', 'Oracle Cloud']);
    expect(d.quality.addedHyperscalers).toEqual(['Oracle Cloud']);
    expect(d.N).toBe(4);
  });

  it('every level has the same total, and completions decrease L1 ≥ L2 ≥ L3 ≥ L4', () => {
    for (const l of d.summary.levels) expect(l.done + l.wip + l.ns).toBe(d.summary.total);
    expect(d.quality.increasing).toEqual([]);
    expect(d.summary.employees).toBeLessThan(d.summary.total);
  });

  it('handles each edge case', () => {
    const e = (id: string) => d.enrollments.filter((x) => x.empId === id);
    expect(e('E29001')[0].levels.slice(0, 2)).toEqual(['done', 'done']); // "Certified" → Completed (choice)
    expect(e('E29002')[0].levels[0]).toBe('done'); // "Foundation" → L1 (choice)
    expect(e('E29003')[0].hyperscaler).toBe('Oracle Cloud');
    expect(e('E29004')[0].dupLevels).toEqual([1]);
    expect(e('E29004')[0].levels[0]).toBe('done');
    expect(e('E29005')[0].skipped).toBe(true);
    expect(e('E29006')[0].emptyLevelRows).toBe(1);
    expect(e('E29007')[0]).toMatchObject({ hyperscaler: 'Anthropic', levels: ['done', 'ns', 'ns', 'ns'], highest: 1 });
    expect(e('E29008')[0].levels[0]).toBe('wip'); // 60% stored as an Excel number
    expect(e('E29008')[0].etas[0]).toBe('2027-01-20');
  });

  it('reads long text dates and real Excel dates', () => {
    const etas = v.rows.map((r) => r.eta).filter(Boolean);
    expect(etas.length).toBeGreaterThan(100);
    expect(etas.every((x) => /^20(26|27)-\d\d-\d\d$/.test(x))).toBe(true);
  });

  it('round-trips through the snapshot CSV', () => {
    const plain = v.rows.map(({ sourceRow: _, ...r }) => r);
    const back = csvToSnapshot(snapshotToCsv(plain));
    expect(back).toEqual(plain);
    expect(buildDataset(back).summary).toEqual(d.summary);
  });

  it('warns at upload about a level above the HyperScaler’s 4 levels (row kept, not counted later)', () => {
    const sheet = {
      name: 'S',
      headers: ['Emp ID', 'Name', 'Reporting Orgn', 'Band', 'HyperScaler', 'ETA (Date)', 'Certificate done/WIP', 'Certification Levels', 'Email ID'],
      rows: [['E1', 'A', 'Org', 'B1', 'AWS', '', 'Completed', 'L5', 'a@example.com']],
      display: [['E1', 'A', 'Org', 'B1', 'AWS', '', 'Completed', 'L5', 'a@example.com']],
      rowNumbers: [2],
      headerRowNumber: 1,
    };
    const res = validateRows(sheet, autoMapColumns(sheet.headers), emptyMappings(), false, TODAY);
    expect(res.rows).toHaveLength(1);
    expect(res.issues.map((i) => i.reason)).toContain("L5 is above AWS's 4 levels: it won't be counted");
    expect(buildDataset(res.rows).quality.overRows).toBe(1);
  });

  it('refuses snapshots in the earlier format', () => {
    expect(() => csvToSnapshot('Emp ID,Name,Reporting Org,Band,HyperScaler,ETA (Date),Certificate done/WIP,Certification levels,Email ID,Added In,Updated In\n')).toThrow(OldFormatError);
  });
});
