import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { GroupRow, PeopleFilter, Summary } from '../lib/aggregate';
import { pct } from '../lib/aggregate';
import { levelRamp } from '../lib/levels';
import { fmtNum } from '../lib/format';
import { peopleUrl } from '../lib/links';
import { SnapLink } from './SnapLink';
import { LvlChip, orNone } from './fde';
import { Lab, LiquidCard, Num, useFill, WAVE } from './liquid';

/* =============== shared: a horizontal tank that pours in once =============== */

export interface Seg {
  key: string;
  v: number;
  /** Status class for the colour, or a custom colour. */
  cls?: St | 'none';
  color?: string;
  ink?: string;
  /** Shown inside the segment when it is wide enough. */
  label?: ReactNode;
  to?: string;
  title: string;
}

const EDGE = (
  <svg viewBox="0 0 26 120" preserveAspectRatio="none" aria-hidden>
    <path d="M13 0 C 26 10, 0 20, 13 30 S 0 50, 13 60 S 26 80, 13 90 S 0 110, 13 120 H0 V0Z" />
  </svg>
);

/** Segments fill from left to right like a liquid, with a moving front, then stay still. */
export function PourBar({ segs, e, h = 34, minShare = 0.05, label }: { segs: Seg[]; e: number; h?: number; minShare?: number; label: string }) {
  const total = segs.reduce((a, s) => a + s.v, 0);
  const p = Math.max(0, Math.min(1, e)) * 100;
  return (
    <div className={`tank ${e > 0 && e < 1 ? 'pouring' : ''}`} style={{ height: h }} role="img" aria-label={`${label}: ${segs.map((s) => `${s.title}`).join(', ')}`}>
      <div className="pour" style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }}>
        {segs
          .filter((s) => s.v > 0)
          .map((s) => {
            const style: CSSProperties = { flex: s.v, background: s.color, color: s.ink };
            const inner = total && s.v / total >= minShare ? s.label : null;
            const cls = `seg ${s.cls ?? ''}`;
            return s.to ? (
              <SnapLink key={s.key} to={s.to} className={cls} style={style} title={`${s.title} (open list)`}>
                {inner}
              </SnapLink>
            ) : (
              <span key={s.key} className={cls} style={style} title={s.title}>
                {inner}
              </span>
            );
          })}
      </div>
      <div className="edge" style={{ left: `${p}%` }}>
        {EDGE}
      </div>
    </div>
  );
}

const statusSegs = (s: Record<St, number>, to?: (k: St) => string, labels = true): Seg[] =>
  (['done', 'wip', 'ns'] as St[]).map((k) => ({ key: k, v: s[k], cls: k, label: labels ? fmtNum(s[k]) : null, to: to?.(k), title: `${STATUS_LABEL[k]}: ${fmtNum(s[k])}` }));

const CardHead = ({ title, tip, right }: { title: string; tip: string; right?: ReactNode }) => (
  <div className="fl-head">
    <h3>{title}</h3>
    <span className="fl-i" title={tip} aria-label={tip}>
      i
    </span>
    {right}
  </div>
);

const Legend = () => (
  <div className="fl-legend">
    {(['done', 'wip', 'ns'] as St[]).map((k) => (
      <span key={k}>
        <i className={`dot ${k}`} />
        {STATUS_LABEL[k]}
      </span>
    ))}
  </div>
);

/* =============== Levels: status per level =============== */

export function LevelStatusCard({ sum, N, base, unit }: { sum: Summary; N: number; base: PeopleFilter; unit: string }) {
  const e = useFill(150, 1500);
  return (
    <div className="fl-card">
      <CardHead title="Status per level" tip={`Every level counts all ${fmtNum(sum.total)} ${unit}; a level with no row in the file counts as Not started. Click a segment for the list.`} />
      <Legend />
      <div className="fl-levels">
        {sum.levels.map((l, i) => (
          <div key={i} className="fl-lvrow">
            <LvlChip lv={i + 1} N={N} />
            <PourBar segs={statusSegs(l, (ls) => peopleUrl({ ...base, lv: i + 1, ls }))} e={Math.min(1, e * 1.15 - i * 0.05)} label={`L${i + 1}`} />
            <SnapLink className="fl-done" to={peopleUrl({ ...base, lv: i + 1, ls: 'done' })} title={`L${i + 1} completed`}>
              ✓ {fmtNum(Math.round(l.done * e))}
            </SnapLink>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============== Levels: funnel as a row of glasses =============== */

export function FunnelGlasses({ sum, N, base, unit }: { sum: Summary; N: number; base: PeopleFilter; unit: string }) {
  const e = useFill(250, 1600);
  const ramp = levelRamp(N);
  const steps = [
    { key: 'all', lab: <>{unit[0].toUpperCase() + unit.slice(1)}</>, v: sum.total, color: '#cbd5e1', to: peopleUrl(base) },
    { key: 'st', lab: <>Started</>, v: sum.started, color: '#93c5fd', to: undefined as string | undefined },
    ...sum.levels.map((l, i) => ({
      key: `l${i}`,
      lab: (
        <>
          <LvlChip lv={i + 1} N={N} /> ✓
        </>
      ),
      v: l.done,
      color: ramp[i].hex,
      to: peopleUrl({ ...base, lv: i + 1, ls: 'done' }),
    })),
  ];
  const conv = steps.map((s, i) => (i === 0 || !steps[i - 1].v ? null : s.v / steps[i - 1].v));
  let worst = -1;
  for (let i = 2; i < steps.length; i++) if (conv[i] !== null && conv[i]! <= 1 && (worst < 0 || conv[i]! < conv[worst]!)) worst = i;
  return (
    <div className="fl-card">
      <CardHead title="Level funnel" tip="Each glass is filled to its share of everyone; the pill between two glasses is the share that continues from the previous step." />
      <div className="glasses">
        {steps.map((s, i) => {
          const share = sum.total ? s.v / sum.total : 0;
          const over = conv[i] !== null && conv[i]! > 1;
          const glass = (
            <>
              <div className="g-lab">{s.lab}</div>
              <div className={`glass ${e > 0 && e < 1 ? 'pouring' : ''}`}>
                <div className="g-liq" style={{ height: `${Math.max(share * 100, s.v ? 3 : 0) * e}%`, background: s.color }}>
                  <svg className="g-wave" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden>
                    <path d={WAVE} style={{ fill: s.color }} />
                  </svg>
                </div>
              </div>
              <span className="bignum n33">{fmtNum(Math.round(s.v * e))}</span>
              <div className="g-sub">{pct(s.v, sum.total)}% of all</div>
            </>
          );
          return (
            <FragmentRow key={s.key}>
              {i > 0 && (
                <div className={`g-pill ${over ? 'over' : i === worst ? 'worst' : ''}`} title={over ? 'More than the previous step: check the data' : i === worst ? 'Lowest conversion: the bottleneck' : 'Share that continues'}>
                  →&nbsp;{conv[i] === null ? '—' : `${pct(s.v, steps[i - 1].v, 0)}%`}
                  {(over || i === worst) && <small>{over ? '⚠ more' : '⚠ bottleneck'}</small>}
                </div>
              )}
              {s.to ? (
                <SnapLink to={s.to} className="g-col">
                  {glass}
                </SnapLink>
              ) : (
                <div className="g-col">{glass}</div>
              )}
            </FragmentRow>
          );
        })}
      </div>
    </div>
  );
}
const FragmentRow = ({ children }: { children: ReactNode }) => <>{children}</>;

/* =============== Levels: highest level completed =============== */

export function HighestCard({ sum, N, base, unit }: { sum: Summary; N: number; base: PeopleFilter; unit: string }) {
  const e = useFill(350, 1500);
  const ramp = levelRamp(N);
  const t = sum.total;
  const segs: Seg[] = [
    { key: 'none', v: sum.highest.none, cls: 'none', color: 'var(--none)', ink: '#334155', label: <Two n={sum.highest.none} l="No level yet" />, to: peopleUrl({ ...base, hi: 0 }), title: `No level completed yet: ${fmtNum(sum.highest.none)}` },
    ...sum.highest.byLevel.map((v, i) => ({
      key: `l${i}`,
      v,
      color: ramp[i].hex,
      ink: ramp[i].ink,
      label: <Two n={v} l={`L${i + 1}`} />,
      to: peopleUrl({ ...base, hi: i + 1 }),
      title: `Highest L${i + 1}: ${fmtNum(v)}`,
    })),
  ];
  return (
    <div className="fl-card">
      <CardHead title="Highest level completed" tip={`Each ${unit === 'employees' ? 'employee' : 'enrollment'} is counted once, at the highest level they completed.`} />
      {sum.reached === 0 && (
        <div className="fl-note">
          <b>No level completed yet.</b> {fmtNum(sum.s.wip)} {unit} are in progress.
        </div>
      )}
      <PourBar segs={segs} e={e} h={55} minShare={0.045} label="Highest level completed" />
      <div className="fl-keys">
        {segs.map((s, idx) => (
          <SnapLink key={s.key} to={s.to!} className="fl-key">
            <i style={{ background: s.color }} />
            {idx === 0 ? 'No level yet' : `L${idx} highest`}
            <b>{fmtNum(s.v)}</b>
            <span>{pct(s.v, t)}%</span>
          </SnapLink>
        ))}
      </div>
    </div>
  );
}
const Two = ({ n, l }: { n: number; l: string }) => (
  <span className="two">
    <b>{fmtNum(n)}</b>
    <small>{l}</small>
  </span>
);

/* =============== Breakdown: Reporting Orgn | Band =============== */

type SortKey = 'total' | 'started' | 'done';

export function BreakdownCard({ orgs, bands, base, multi }: { orgs: GroupRow[]; bands: GroupRow[]; base: PeopleFilter; multi: boolean }) {
  const [by, setBy] = useState<'org' | 'band'>('org');
  const [sort, setSort] = useState<SortKey>('total');
  const [all, setAll] = useState(false);
  const e = useFill(200, 1300);
  const rows = by === 'org' ? orgs : bands;
  const sorted = useMemo(() => {
    const started = (g: GroupRow) => (g.total ? (g.s.done + g.s.wip) / g.total : 0);
    const cmp: Record<SortKey, (a: GroupRow, b: GroupRow) => number> = {
      total: (a, b) => b.total - a.total,
      started: (a, b) => started(b) - started(a),
      done: (a, b) => b.s.done - a.s.done,
    };
    return [...rows].sort((a, b) => (a.name === '' ? 1 : 0) - (b.name === '' ? 1 : 0) || cmp[sort](a, b) || a.name.localeCompare(b.name));
  }, [rows, sort]);
  const LIMIT = 8;
  const shown = all ? sorted : sorted.slice(0, LIMIT);
  const max = Math.max(1, ...rows.map((r) => r.total));
  const link = (r: GroupRow) => peopleUrl(by === 'org' ? { ...base, org: r.name } : { ...base, band: r.name });
  return (
    <div className="fl-card">
      <CardHead
        title="Breakdown"
        tip="Each row opens the employee list for that group."
        right={
          <div className="fl-ctrls">
            <div className="seg-tg" role="tablist" aria-label="Group by">
              {(
                [
                  ['org', `Reporting Orgn · ${orgs.length}`],
                  ['band', `Band · ${bands.length}`],
                ] as const
              ).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={by === k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>
                  {l}
                </button>
              ))}
            </div>
            <label className="fl-sort">
              Sort
              <select className="sel" value={sort} onChange={(ev) => setSort(ev.target.value as SortKey)}>
                <option value="total">{multi ? 'Enrollments' : 'Employees'}</option>
                <option value="started">% started</option>
                <option value="done">Completed</option>
              </select>
            </label>
          </div>
        }
      />
      <div className="bd-rows">
        {shown.map((r, i) => (
          <SnapLink key={r.name || '∅'} to={link(r)} className={`bd-row ${r.name ? '' : 'other'}`}>
            <span className="bd-name">
              {orNone(r.name)}
              {multi && <small>{fmtNum(r.employees)} employees</small>}
            </span>
            <span className="bignum n26">{fmtNum(r.total)}</span>
            <span className="bd-bar" style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}>
              <PourBar segs={statusSegs(r.s, undefined, false)} e={Math.min(1, e * 1.2 - i * 0.03)} h={13} label={orNone(r.name)} />
            </span>
            <span className="bd-st">{pct(r.s.done + r.s.wip, r.total, 0)}% started</span>
            <span className={`bd-dn ${r.s.done ? '' : 'z'}`}>{r.s.done ? `✓ ${fmtNum(r.s.done)}` : '—'}</span>
            <span className="bd-chev" aria-hidden>
              ›
            </span>
          </SnapLink>
        ))}
      </div>
      {sorted.length > LIMIT && (
        <button className="bd-more" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer ▴' : `Show all ${sorted.length} ▾`}
        </button>
      )}
    </div>
  );
}

/* =============== compact liquid stat cards (Employees list, import summary) =============== */

export function StatRow({
  sum,
  totalLabel,
  totalSub,
  to,
  active,
}: {
  sum: Summary;
  totalLabel: string;
  totalSub: ReactNode;
  /** Link for each status card; omit to make them static. */
  to?: (k: St) => string;
  /** The status currently filtered on: its card is ringed, the others dim. */
  active?: St;
}) {
  const t = sum.total;
  return (
    <div className="g4">
      <LiquidCard i={0} compact>
        {(e) => (
          <>
            <Lab>{totalLabel}</Lab>
            <Num value={t} e={e} cls="n42" />
            <div className="lq-sub">{totalSub}</div>
          </>
        )}
      </LiquidCard>
      {(['wip', 'done', 'ns'] as St[]).map((k, i) => (
        <LiquidCard
          key={k}
          i={i + 1}
          compact
          level={t ? (sum.s[k] / t) * 100 : 0}
          tone={k}
          to={to?.(k)}
          state={active ? (active === k ? 'selected' : 'dim') : undefined}
          corner={active === k ? '✓ Filter on' : undefined}
        >
          {(e) => (
            <>
              <Lab dot={k}>{STATUS_LABEL[k]}</Lab>
              <Num value={sum.s[k]} e={e} cls="n42" />
              <div className="lq-sub">{pct(sum.s[k], t)}% of total</div>
            </>
          )}
        </LiquidCard>
      ))}
    </div>
  );
}

/** Plain compact tile with a big number (no liquid), e.g. "Rows saved". */
export function NumberTile({ i, label, value, sub }: { i: number; label: string; value: number; sub?: ReactNode }) {
  return (
    <LiquidCard i={i} compact>
      {(e) => (
        <>
          <Lab>{label}</Lab>
          <Num value={value} e={e} cls="n42" />
          {sub && <div className="lq-sub">{sub}</div>}
        </>
      )}
    </LiquidCard>
  );
}
