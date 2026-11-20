import { describe, expect, it } from 'vitest';
import { buildSnapshotId, isSnapshotId, parseSnapshotId, uploadOrderKey } from '../lib/snapshotName';

describe('snapshot ids', () => {
  const now = new Date(2026, 10, 18, 9, 30, 5); // 18 Nov 2026 09:30:05 local

  it('uses the latest sheet date, today and the time, all zero-padded', () => {
    expect(buildSnapshotId('2026-11-15', now)).toBe('151126-181126-093005');
  });

  it('falls back to today when the sheet has no dates', () => {
    expect(buildSnapshotId(null, now)).toBe('181126-181126-093005');
  });

  it('parses back into dates', () => {
    const p = parseSnapshotId('151126-181126-093005')!;
    expect(p.dataUpTo).toEqual(new Date(2026, 10, 15));
    expect(p.uploadedAt).toEqual(now);
    expect(isSnapshotId('151126-181126-093005')).toBe(true);
    expect(isSnapshotId('151126-181126-93005')).toBe(false);
    expect(parseSnapshotId('nope')).toBeNull();
  });

  it('orders snapshots by upload time, not by data date', () => {
    const ids = ['301226-020127-080000', '151126-181126-093005', '011126-181126-120000'];
    const sorted = [...ids].sort((a, b) => uploadOrderKey(a).localeCompare(uploadOrderKey(b)));
    expect(sorted).toEqual(['151126-181126-093005', '011126-181126-120000', '301226-020127-080000']);
  });
});
