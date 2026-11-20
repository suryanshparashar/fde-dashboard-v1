import { describe, expect, it } from 'vitest';
import { toIsoDate } from '../lib/parse';
import { ruleLevel, ruleStatus } from '../lib/rules';
import { knownHyperscaler, shownHyperscalers, sortHyperscalers } from '../lib/hyperscalers';
import { autoMapColumns, missingRequired } from '../lib/columns';
import { levelRamp } from '../lib/levels';

describe('HyperScaler rule: 7 known names', () => {
  it.each([
    ['Anthropic', 'Anthropic'], ['Claude', 'Anthropic'], ['Anthropic Claude', 'Anthropic'], ['anthropic-claude', 'Anthropic'], ['Anthropic FDE', 'Anthropic'],
    ['Azure', 'Azure'], ['MS Azure', 'Azure'], ['Microsoft Azure', 'Azure'], ['Microsoft', 'Azure'], ['Microsoft FDE', 'Azure'],
    ['AWS', 'AWS'], ['aws', 'AWS'], ['AWS FDE', 'AWS'],
    ['Google', 'Google'], ['GCP', 'Google'], ['Google Cloud', 'Google'], ['Google FDE', 'Google'],
    ['GitHub', 'GitHub'], ['GitHub Copilot', 'GitHub'], ['GitHub FDE', 'GitHub'],
    ['OpenShift', 'Red Hat OpenShift'], ['Red Hat OpenShift', 'Red Hat OpenShift'], ['Red Hat OpenShift FDE', 'Red Hat OpenShift'],
    ['Ansible', 'Red Hat Ansible Automation'], ['Red Hat Ansible', 'Red Hat Ansible Automation'], ['Red Hat Ansible Automation FDE', 'Red Hat Ansible Automation'],
  ])('%s → %s', (input, out) => expect(knownHyperscaler(input)).toBe(out));
  it('anything else is not built in (added automatically by the validator and flagged)', () => {
    expect(knownHyperscaler('Oracle Cloud')).toBeNull();
    expect(knownHyperscaler('Red Hat')).toBeNull(); // ambiguous between the two Red Hat products
    expect(knownHyperscaler('FDE')).toBeNull();
    expect(knownHyperscaler('')).toBeNull();
  });
  it('orders the known ones first (base 4, then GitHub and Red Hat), then added ones alphabetically', () => {
    expect(sortHyperscalers(['Zeta', 'Red Hat OpenShift', 'Google', 'Oracle', 'GitHub', 'Anthropic', 'AWS', 'Azure'])).toEqual([
      'Anthropic', 'Azure', 'AWS', 'Google', 'GitHub', 'Red Hat OpenShift', 'Oracle', 'Zeta',
    ]);
  });
  it('always shows the 4 base HyperScalers, even without data', () => {
    expect(shownHyperscalers([])).toEqual(['Anthropic', 'Azure', 'AWS', 'Google']);
    expect(shownHyperscalers(['GitHub', 'AWS', 'Oracle Cloud'])).toEqual(['Anthropic', 'Azure', 'AWS', 'Google', 'GitHub', 'Oracle Cloud']);
  });
});

describe('Status rule', () => {
  it.each([
    ['', 'ns'], ['  ', 'ns'],
    ['WIP', 'wip'], ['wip', 'wip'], ['In progress', 'wip'], ['In Progress', 'wip'], ['in-progress', 'wip'], ['40%', 'wip'], ['75 %', 'wip'], ['12.5%', 'wip'],
    ['Completed', 'done'], ['completed', 'done'], ['YES', 'done'], ['Yes', 'done'], ['Done', 'done'], ['done', 'done'],
    ['Not started', 'ns'],
  ])('"%s" → %s', (input, out) => expect(ruleStatus(input)).toBe(out));
  it.each(['Certified', 'Complete', 'No', 'Pending', '0.4'])('"%s" → uploader decides', (v) => expect(ruleStatus(v)).toBeNull());
});

describe('Level rule', () => {
  it.each([
    ['L1', 1], ['l2', 2], ['Level 1', 1], ['Level-2', 2], ['Level_3', 3], ['level 4', 4], ['LEVEL4', 4], ['L5', 5], ['Level 10', 10],
  ])('%s → %s', (input, out) => expect(ruleLevel(input)).toBe(out));
  it.each(['Foundation', '1', 'Advanced', 'II', 'L0', 'Lvl 2'])('"%s" → uploader decides', (v) => expect(ruleLevel(v)).toBeNull());
});

describe('ETA dates', () => {
  it('reads "Wednesday, November 18, 2026" and other long forms', () => {
    expect(toIsoDate('Wednesday, November 18, 2026')).toBe('2026-11-18');
    expect(toIsoDate('Thursday, January 7, 2027')).toBe('2027-01-07');
    expect(toIsoDate('Wed, Nov 18, 2026')).toBe('2026-11-18');
    expect(toIsoDate('November 18, 2026')).toBe('2026-11-18');
  });
  it('reads Excel serial numbers (1900 and 1904 systems)', () => {
    expect(toIsoDate(46344)).toBe('2026-11-18');
    expect(toIsoDate(46344 - 1462, true)).toBe('2026-11-18');
  });
  it('reads ISO and day-first numeric strings', () => {
    expect(toIsoDate('2026-10-01')).toBe('2026-10-01');
    expect(toIsoDate('01-10-2026')).toBe('2026-10-01');
    expect(toIsoDate('18/11/26')).toBe('2026-11-18');
  });
  it('rejects junk and impossible dates', () => {
    expect(toIsoDate('soon')).toBeNull();
    expect(toIsoDate('Wednesday, February 30, 2026')).toBeNull();
  });
});

describe('Columns', () => {
  it('maps the exact 9 headers of the monthly sheet', () => {
    const m = autoMapColumns(['Emp ID', 'Name', 'Reporting Orgn', 'Band', 'HyperScaler', 'ETA (Date)', 'Certificate done/WIP', 'Certification Levels', 'Email ID']);
    expect(m).toEqual({ empId: 0, name: 1, reportingOrg: 2, band: 3, hyperscaler: 4, eta: 5, status: 6, level: 7, email: 8 });
    expect(missingRequired(m)).toEqual([]);
  });
});

describe('Level colours', () => {
  it('generates N distinct colours, light to dark, for any N', () => {
    for (const n of [1, 3, 4, 6, 9]) {
      const r = levelRamp(n);
      expect(r).toHaveLength(n);
      expect(new Set(r.map((c) => c.hex)).size).toBe(n);
    }
  });
});
