import { type ReactNode } from 'react';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { Counts, Dataset, PeopleFilter, Quality, Summary } from '../lib/aggregate';
import { increasingLevels, pct } from '../lib/aggregate';
import { levelRamp } from '../lib/levels';
import { fmtNum } from '../lib/format';
import { hsUrl, peopleUrl } from '../lib/links';
import { isKnownHyperscaler, shownHyperscalers } from '../lib/hyperscalers';
import { SnapLink } from './SnapLink';
import { HsLogo } from './HsLogo';

const STS: St[] = ['done', 'wip', 'ns'];
/** '1 row', '3 rows' */
const n = (v: number, one: string, many = one + 's') => `${fmtNum(v)} ${v === 1 ? one : many}`;

/* ---------------- small pieces ---------------- */

export function LvlChip({ lv, N }: { lv: number; N: number }) {
  const c = levelRamp(Math.max(N, lv))[lv - 1];
  return (
    <span className="lvl" style={{ background: c.hex, color: c.ink }}>
      L{lv}
    </span>
  );
}

export function NewTag({ name }: { name: string }) {
  return isKnownHyperscaler(name) ? null : (
    <span className="tag-new" title="Not one of the 7 known HyperScalers: added automatically from the uploaded file">
      added from file
    </span>
  );
}

/** "Not given" label for empty Reporting Orgn / Band. */
export const orNone = (v: string) => v || 'Not given';

/* ---------------- status bar + legend ---------------- */

/** 100% bar: Completed | In progress | Not started. Segments link to the matching employee list when `to` is given. */
export function StatusBar({ s, big, to, label }: { s: Counts; big?: boolean; to?: (st: St) => string; label?: string }) {
  const t = s.done + s.wip + s.ns;
  if (!t) return <div className={`sbar empty-bar ${big ? 'big' : ''}`} aria-label="No data" />;
  return (
    <div className={`sbar ${big ? 'big' : ''}`} role="img" aria-label={`${label ? `${label}: ` : ''}${STS.map((k) => `${STATUS_LABEL[k]} ${s[k]}`).join(', ')}`}>
      {STS.map((k) =>
        s[k] ? (
          to ? (
            <SnapLink key={k} to={to(k)} className={k} style={{ flex: s[k] }} title={`${STATUS_LABEL[k]}: ${fmtNum(s[k])} · ${pct(s[k], t)}% (open list)`} />
          ) : (
            <i key={k} className={k} style={{ flex: s[k] }} title={`${STATUS_LABEL[k]}: ${fmtNum(s[k])} · ${pct(s[k], t)}%`} />
          )
        ) : null,
      )}
    </div>
  );
}

/* ---------------- navigation ---------------- */

export function Breadcrumb({ parts }: { parts: { label: string; to?: string }[] }) {
  return (
    <nav className="bc" aria-label="Breadcrumb">
      {parts.map((p, i) =>
        i < parts.length - 1 ? (
          <span key={i} className="contents">
            <SnapLink to={p.to ?? '/'}>{p.label}</SnapLink>
            <span className="sep">›</span>
          </span>
        ) : (
          <b key={i} aria-current="page">
            {p.label}
          </b>
        ),
      )}
    </nav>
  );
}

export function Stepper({ list, current }: { list: string[]; current: string }) {
  const i = list.indexOf(current);
  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  return (
    <div className="stepper">
      {prev ? <SnapLink to={hsUrl(prev)}>‹ {prev}</SnapLink> : <span className="dis">‹ Prev</span>}
      <b>
        {i + 1} of {list.length}
      </b>
      {next ? <SnapLink to={hsUrl(next)}>{next} ›</SnapLink> : <span className="dis">Next ›</span>}
    </div>
  );
}

/** HyperScaler tabs under the header: Overall + one per HyperScaler. */
export function HsTabs({ dataset, active }: { dataset: Dataset; active: string | null }) {
  const counts = new Map<string, number>();
  for (const e of dataset.enrollments) counts.set(e.hyperscaler, (counts.get(e.hyperscaler) ?? 0) + 1);
  return (
    <nav className="subtabs" aria-label="HyperScaler views">
      <SnapLink to="/" className={active === null ? 'on' : ''}>
        <b>Overall</b> <small>{fmtNum(dataset.summary.employees)} employees</small>
      </SnapLink>
      {shownHyperscalers(dataset.hyperscalers).map((h) => (
        <SnapLink key={h} to={hsUrl(h)} className={active === h ? 'on' : ''}>
          <HsLogo name={h} sm />
          <b>{h}</b> <small>{fmtNum(counts.get(h) ?? 0)}</small>
        </SnapLink>
      ))}
    </nav>
  );
}

/* ---------------- data quality ---------------- */

export function DataQuality({ q, sum, base, scope }: { q: Quality; sum: Summary; base: PeopleFilter; scope?: string }) {
  const inc = increasingLevels(sum);
  const items: ReactNode[] = [];
  if (q.addedHyperscalers.length && !base.hs)
    items.push(
      <>
        <b>{q.addedHyperscalers.join(', ')}</b> {q.addedHyperscalers.length > 1 ? 'are' : 'is'} not one of the 7 known HyperScalers (Anthropic, Azure, AWS, Google, GitHub, Red Hat OpenShift, Red Hat Ansible Automation) and
        was added automatically from the file.
      </>,
    );
  if (inc.length)
    items.push(
      <>
        Completed counts go up at {inc.map((l) => `L${l}`).join(', ')} (L1 ≥ L2 ≥ … expected, since levels are cumulative).
      </>,
    );
  if (q.skipped)
    items.push(
      <>
        <SnapLink to={peopleUrl({ ...base, flag: 'skip' })}>{n(q.skipped, 'enrollment')}</SnapLink> {q.skipped === 1 ? 'has' : 'have'} a level completed while a lower level isn't.
      </>,
    );
  if (q.duplicateRows)
    items.push(
      <>
        <b>{n(q.duplicateRows, 'row')}</b> {q.duplicateRows === 1 ? 'repeats' : 'repeat'} the same employee × HyperScaler × level (in{' '}
        <SnapLink to={peopleUrl({ ...base, flag: 'dup' })}>{n(q.duplicateEnrollments, 'enrollment')}</SnapLink>). The furthest status was kept.
      </>,
    );
  if (q.overRows)
    items.push(
      <>
        <b>{n(q.overRows, 'row')}</b> {q.overRows === 1 ? 'is' : 'are'} above its HyperScaler's levels (e.g. L5 when it has 4) and {q.overRows === 1 ? 'is' : 'are'} not counted (
        <SnapLink to={peopleUrl({ ...base, flag: 'over' })}>{n(q.overEnrollments, 'enrollment')}</SnapLink>). Level counts are set in levelConfig.ts.
      </>,
    );
  if (q.emptyLevelRows)
    items.push(
      <>
        <b>{n(q.emptyLevelRows, 'row')}</b> {q.emptyLevelRows === 1 ? 'has' : 'have'} an empty Certification Level (
        <SnapLink to={peopleUrl({ ...base, flag: 'nolevel' })}>see enrollments</SnapLink>): they count as enrollments but not in any level.
      </>,
    );
  if (q.profileConflicts.length)
    items.push(
      <>
        <b>{n(new Set(q.profileConflicts.map((c) => c.empId)).size, 'employee')}</b> with different values across their rows (e.g.{' '}
        {q.profileConflicts
          .slice(0, 2)
          .map((c) => `${c.empId} ${c.field}: ${c.values.join(' / ')}`)
          .join('; ')}
        ). The first value is used.
      </>,
    );
  if (q.noOrg) items.push(<><b>{n(q.noOrg, 'employee')}</b> without a Reporting Orgn (shown as "Not given").</>);
  if (q.noBand) items.push(<><b>{n(q.noBand, 'employee')}</b> without a Band (shown as "Not given").</>);
  if (q.noEmail) items.push(<><b>{n(q.noEmail, 'employee')}</b> without an Email ID.</>);

  if (!items.length)
    return (
      <div className="dq ok">
        <div className="h2">✓ Data checks passed{scope ? ` for ${scope}` : ''}</div>
        <div className="h2-sub" style={{ color: '#166534' }}>
          Levels are cumulative (L1 ≥ L2 ≥ …), no duplicate rows, no skipped levels, and every employee has an Org, Band and Email ID.
        </div>
      </div>
    );
  return (
    <div className="dq">
      <div className="h2">⚠ Data checks{scope ? `: ${scope}` : ''}</div>
      <ul style={{ marginTop: 6 }}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
