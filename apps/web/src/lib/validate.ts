import { z } from 'zod';
import type { CleanRow, Field, RowIssue, St } from '../types';
import type { ColumnMapping } from './columns';
import type { ParsedSheet } from './parse';
import { toIsoDate } from './parse';
import { hsKey, knownHyperscaler } from './hyperscalers';
import { ruleLevel, ruleStatus, valueKey } from './rules';
import type { Mappings } from './mappings';
import { todayIso } from './format';
import { levelsFor } from './levelConfig';

/** Text cell → trimmed single-spaced string; integer-like numbers lose the ".0" (1023.0 → "1023"). */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return String(v).replace(/\s+/g, ' ').trim();
}

/** A cell value the rules don't cover, with where it appears. */
export interface UnknownValue {
  key: string;
  raw: string;
  count: number;
  rows: number[];
}

export interface NewHyperscaler extends UnknownValue {
  /** Name it gets when kept as a new HyperScaler. */
  name: string;
}

export interface ValidationResult {
  /** Rows ready to save (rows still waiting for a decision are not included). */
  rows: CleanRow[];
  issues: RowIssue[];
  /** Latest completion date among Completed rows that is not in the future (ISO), or null. Used in the snapshot file name. */
  latestDoneDate: string | null;
  /** Status values the uploader has to categorize. */
  unknownStatus: UnknownValue[];
  /** Level values the uploader has to categorize. */
  unknownLevel: UnknownValue[];
  /** HyperScalers that aren't one of the 4 and weren't seen before: added automatically, flagged for the uploader. */
  newHyperscalers: NewHyperscaler[];
  /** Rows not saved because the uploader chose "skip" for their value. */
  skippedByChoice: number;
}

const EMAIL = z.string().email();

function collect<T extends UnknownValue>(map: Map<string, T>, key: string, make: () => T, row: number) {
  let u = map.get(key);
  if (!u) map.set(key, (u = make()));
  u.count++;
  u.rows.push(row);
}

/**
 * @param savedHsKeys HyperScaler spellings remembered from earlier uploads. Spellings not in it (and not one of the 4)
 *   are listed in newHyperscalers even when this upload already has a choice for them, so the choice can be changed.
 */
export function validateRows(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  mappings: Mappings,
  date1904 = false,
  today = todayIso(),
  savedHsKeys: Set<string> = new Set(Object.keys(mappings.hyperscaler)),
): ValidationResult {
  const rows: CleanRow[] = [];
  const issues: RowIssue[] = [];
  const unknownStatus = new Map<string, UnknownValue>();
  const unknownLevel = new Map<string, UnknownValue>();
  const newHs = new Map<string, NewHyperscaler>();
  let skippedByChoice = 0;
  const col = (f: Field) => mapping[f];
  const get = (r: unknown[], f: Field) => (col(f) == null ? '' : r[col(f) as number]);

  sheet.rows.forEach((r, i) => {
    const row = sheet.rowNumbers[i];
    const shown = sheet.display?.[i] ?? [];
    const empId = cellText(get(r, 'empId'));
    const name = cellText(get(r, 'name'));
    const fail = (reason: string, value?: string) => issues.push({ row, empId, severity: 'error', reason, value });
    const warn = (reason: string, value?: string) => issues.push({ row, empId, severity: 'warning', reason, value });

    if (!empId) return void fail('Missing Emp ID (row skipped)', name || undefined);
    if (!name) warn('Missing Name');

    // HyperScaler: remembered choice → built-in rule → added automatically.
    const rawHs = cellText(get(r, 'hyperscaler'));
    if (!rawHs) return void fail('Missing HyperScaler (row skipped)');
    const hk = hsKey(rawHs);
    const builtIn = knownHyperscaler(rawHs);
    if (!builtIn && !savedHsKeys.has(hk)) collect(newHs, hk, () => ({ key: hk, raw: rawHs, name: rawHs, count: 0, rows: [] }), row);
    const hyperscaler = mappings.hyperscaler[hk] ?? builtIn ?? newHs.get(hk)!.name;

    // Status: percentages are read as Excel shows them ("40%"), not as 0.4.
    const statusCell = get(r, 'status');
    const statusText = typeof statusCell === 'number' && col('status') != null ? cellText(shown[col('status') as number] ?? statusCell) : cellText(statusCell);
    const sk = valueKey(statusText);
    const status: St | 'skip' | null = ruleStatus(statusText) ?? mappings.status[sk] ?? null;

    // Level
    const levelText = cellText(get(r, 'level'));
    const lk = valueKey(levelText);
    const level: number | 'skip' | null = levelText ? (ruleLevel(levelText) ?? mappings.level[lk] ?? null) : 0;

    let pending = false;
    if (status === null) {
      collect(unknownStatus, sk, () => ({ key: sk, raw: statusText, count: 0, rows: [] }), row);
      pending = true;
    }
    if (level === null) {
      collect(unknownLevel, lk, () => ({ key: lk, raw: levelText, count: 0, rows: [] }), row);
      pending = true;
    }
    if (pending) return;
    if (status === 'skip' || level === 'skip') {
      skippedByChoice++;
      return void warn('Skipped (your choice for this value)', status === 'skip' ? statusText : levelText);
    }
    if (level === 0) warn('Certification Level is empty: counted as an enrollment but not in any level');
    else if (level > levelsFor(hyperscaler)) warn(`L${level} is above ${hyperscaler}'s ${levelsFor(hyperscaler)} levels: it won't be counted`, levelText);

    const rawEta = get(r, 'eta');
    const etaText = cellText(rawEta);
    let eta = '';
    if (etaText) {
      const parsed = toIsoDate(rawEta, date1904);
      if (parsed === null) warn('ETA date not readable (left empty)', etaText);
      else eta = parsed;
    }
    if (status === 'done' && eta > today) warn('Completed, but the ETA date is in the future', eta);

    const email = cellText(get(r, 'email'));
    if (email && !EMAIL.safeParse(email).success) warn('Email looks invalid (kept as is)', email);

    rows.push({
      empId,
      name,
      reportingOrg: cellText(get(r, 'reportingOrg')),
      band: cellText(get(r, 'band')),
      hyperscaler,
      eta,
      status,
      level,
      email,
      sourceRow: row,
    });
  });

  const latestDoneDate = rows.reduce<string | null>((max, r) => (r.status === 'done' && r.eta && r.eta <= today && (max == null || r.eta > max) ? r.eta : max), null);
  const byCount = <T extends UnknownValue>(m: Map<string, T>) => [...m.values()].sort((a, b) => b.count - a.count);
  return {
    rows,
    issues,
    latestDoneDate,
    unknownStatus: byCount(unknownStatus),
    unknownLevel: byCount(unknownLevel),
    newHyperscalers: byCount(newHs),
    skippedByChoice,
  };
}
