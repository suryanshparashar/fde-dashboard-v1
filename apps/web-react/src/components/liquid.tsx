import { useEffect, useState, type ReactNode } from 'react';
import type { St } from '../types';
import type { Dataset, PeopleFilter, Quality, Summary } from '../lib/aggregate';
import { increasingLevels, pct } from '../lib/aggregate';
import { fmtNum } from '../lib/format';
import { hsUrl, peopleUrl } from '../lib/links';
import { isKnownHyperscaler, shownHyperscalers } from '../lib/hyperscalers';
import { HsLogo } from './HsLogo';
export { HsLogo };
import { SnapLink } from './SnapLink';
import { DataQuality, StatusBar } from './fde';

/* ---------------- animation: once on load, then still ---------------- */

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** 0 → 1 over `dur` ms after `delay` ms, once per mount (1 straight away with reduced motion). */
export function useFill(delay: number, dur = 1300): number {
  const [e, setE] = useState(() => (reduced() ? 1 : 0));
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
      setE(easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delay, dur]);
  return e;
}

/**
 * The liquid waves for as long as the pointer (or keyboard focus) is on the card, and freezes in place
 * when it leaves (the CSS pauses the animation rather than removing it, so there is no jump).
 */
function useHoverWave() {
  const [on, setOn] = useState(false);
  const start = () => !reduced() && setOn(true);
  const stop = () => setOn(false);
  return { on, handlers: { onMouseEnter: start, onMouseLeave: stop, onFocus: start, onBlur: stop } };
}

export function Num({ value, e, dec = 0, suffix = '', cls = 'n68' }: { value: number; e: number; dec?: number; suffix?: string; cls?: string }) {
  const v = value * e;
  return (
    <span className={`bignum ${cls} ${e < 1 ? 'counting' : ''}`}>
      {dec ? v.toFixed(dec) : fmtNum(Math.round(v))}
      {suffix}
    </span>
  );
}

export const WAVE = 'M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V20 H0Z';
function Liquid({ level, tone }: { level: number; tone: string }) {
  return (
    <div className={`liq ${tone}`} style={{ height: `${level}%` }} aria-hidden>
      <svg className="wave" viewBox="0 0 200 20" preserveAspectRatio="none">
        <path d={WAVE} />
      </svg>
      <svg className="wave w2" viewBox="0 0 200 20" preserveAspectRatio="none">
        <path d={WAVE} />
      </svg>
    </div>
  );
}

/** A card that fills like a glass to `level` %. */
export function LiquidCard({
  i,
  level,
  tone,
  to,
  onClick,
  warn,
  bad,
  children,
  extra,
  compact,
  state,
  corner,
}: {
  compact?: boolean;
  /** Selected = this status is the active filter (ring + tag); dim = another status is. */
  state?: 'selected' | 'dim';
  /** Small tag in the top-right corner. */
  corner?: ReactNode;
  i: number;
  level?: number;
  tone?: string;
  to?: string;
  onClick?: () => void;
  warn?: boolean;
  bad?: boolean;
  children: (e: number) => ReactNode;
  extra?: (e: number) => ReactNode;
}) {
  const e = useFill(i * 110);
  const wave = useHoverWave();
  const cls = `lq ${state ?? ''} ${tone ?? ''} ${compact ? 'sm' : ''} ${warn ? 'warn' : ''} ${bad ? 'bad' : ''} ${(e > 0 && e < 1) || wave.on ? 'moving' : ''}`;
  const body = (
    <>
      {level !== undefined && tone && <Liquid level={Math.max(level, 4) * e} tone={tone} />}
      {extra?.(e)}
      {corner && <span className="lq-corner">{corner}</span>}
      <div className="in">{children(e)}</div>
    </>
  );
  if (to)
    return (
      <SnapLink to={to} className={cls} {...wave.handlers}>
        {body}
      </SnapLink>
    );
  if (onClick)
    return (
      <button type="button" className={cls} {...wave.handlers} onClick={onClick}>
        {body}
      </button>
    );
  return (
    <div className={cls} {...wave.handlers}>
      {body}
    </div>
  );
}

export const Lab = ({ children, dot }: { children: ReactNode; dot?: St }) => (
  <div className="lq-lab">
    {dot && <i className={`dot ${dot}`} />}
    {children}
  </div>
);

/** "▲ 1.8 pts vs Overall"; within 10% of the Overall value reads as the same. */
export function Compare({ v, pv }: { v: number; pv: number }) {
  const d = v - pv;
  const cls = Math.abs(d) < Math.max(0.1, pv * 0.1) ? 'eq' : d > 0 ? 'up' : 'down';
  return cls === 'eq' ? (
    <span className="cmpb eq">≈ same as Overall ({pv.toFixed(1)}%)</span>
  ) : (
    <span className={`cmpb ${cls}`}>
      {cls === 'up' ? '▲' : '▼'} {Math.abs(d).toFixed(1)} pts vs Overall
    </span>
  );
}
const p100 = (v: number, t: number) => (t ? (v / t) * 100 : 0);

/* ---------------- status: 4 liquid cards ---------------- */

export function StatusCards({ sum, base, parent }: { sum: Summary; base: PeopleFilter; parent?: Summary }) {
  const t = sum.total;
  const parts: [St, string, number][] = [
    ['wip', 'In progress', sum.s.wip],
    ['done', 'Completed', sum.s.done],
    ['ns', 'Not started', sum.s.ns],
  ];
  return (
    <div className="g4">
      <LiquidCard
        i={0}
        to={peopleUrl(base)}
        extra={(e) => (
          <div className="tubes" aria-hidden>
            {(['done', 'wip', 'ns'] as St[]).map((k) => (
              <div className="tube" key={k}>
                <i className={k} style={{ height: `${Math.max(p100(sum.s[k], t), 4) * e}%` }} />
              </div>
            ))}
          </div>
        )}
      >
        {(e) => (
          <>
            <Lab>Total enrolled</Lab>
            <Num value={t} e={e} />
            <div className="lq-sub">
              {parent ? `${pct(t, parent.employees, 0)}% of all ${fmtNum(parent.employees)} employees` : `${fmtNum(sum.employees)} employees`}
            </div>
          </>
        )}
      </LiquidCard>
      {parts.map(([k, label, v], i) => (
        <LiquidCard key={k} i={i + 1} level={p100(v, t)} tone={k} to={peopleUrl({ ...base, st: k })}>
          {(e) => (
            <>
              <Lab dot={k}>{label}</Lab>
              <Num value={v} e={e} />
              <div className="lq-sub">
                {pct(v, t)}% of total{k === 'done' && sum.levels.length > 1 ? ` · all ${sum.levels.length} levels` : ''}
              </div>
              {parent && k === 'done' && <Compare v={p100(v, t)} pv={p100(parent.s.done, parent.total)} />}
            </>
          )}
        </LiquidCard>
      ))}
    </div>
  );
}

/* ---------------- key insights: 4 liquid cards + data checks ---------------- */

export function countChecks(q: Quality, withHs: boolean): number {
  return [withHs && q.addedHyperscalers.length, q.increasing.length, q.skipped, q.duplicateRows, q.emptyLevelRows, q.overRows, q.profileConflicts.length, q.noOrg, q.noBand, q.noEmail].filter(Boolean).length;
}

export function InsightCards({ sum, q, base, parent }: { sum: Summary; q: Quality; base: PeopleFilter; parent?: Summary }) {
  const [open, setOpen] = useState(false);
  const t = sum.total;
  const steps = [sum.started, ...sum.levels.map((l) => l.done)];
  let w = -1;
  for (let i = 1; i < steps.length; i++) if (steps[i - 1] && (w < 0 || steps[i] / steps[i - 1] < steps[w] / steps[w - 1])) w = i;
  const inc = increasingLevels(sum);
  const checks = countChecks(q, !base.hs);
  return (
    <>
      <div className="g4">
        <LiquidCard i={4} level={p100(sum.started, t)} tone="ind">
          {(e) => (
            <>
              <Lab>Started</Lab>
              <Num value={p100(sum.started, t)} e={e} dec={1} suffix="%" cls="n53" />
              <div className="lq-sub">
                {fmtNum(sum.started)} of {fmtNum(t)}
              </div>
              {parent && <Compare v={p100(sum.started, t)} pv={p100(parent.started, parent.total)} />}
            </>
          )}
        </LiquidCard>
        <LiquidCard i={5} level={p100(sum.reached, t)} tone="ind">
          {(e) => (
            <>
              <Lab>Reached L1+</Lab>
              <Num value={p100(sum.reached, t)} e={e} dec={1} suffix="%" cls="n53" />
              <div className="lq-sub">{fmtNum(sum.reached)} completed a level</div>
              {parent && <Compare v={p100(sum.reached, t)} pv={p100(parent.reached, parent.total)} />}
            </>
          )}
        </LiquidCard>
        {inc.length ? (
          <LiquidCard i={6} bad>
            {() => (
              <>
                <Lab>Levels don't add up</Lab>
                <span className="bignum n53" style={{ color: '#991b1b' }}>
                  L{inc[0]} &gt; L{inc[0] - 1} ⚠
                </span>
                <div className="lq-sub">
                  {fmtNum(sum.levels[inc[0] - 1].done)} vs {fmtNum(sum.levels[inc[0] - 2].done)} completed
                </div>
              </>
            )}
          </LiquidCard>
        ) : w > 0 ? (
          <LiquidCard i={6} level={p100(steps[w], steps[w - 1])} tone="amb" warn>
            {() => (
              <>
                <Lab>Biggest drop</Lab>
                <span className="bignum n53">{w === 1 ? 'Start → L1' : `L${w - 1} → L${w}`}</span>
                <div className="lq-sub">
                  only <b>{pct(steps[w], steps[w - 1], 0)}%</b> continue
                </div>
              </>
            )}
          </LiquidCard>
        ) : (
          <LiquidCard i={6}>
            {() => (
              <>
                <Lab>Biggest drop</Lab>
                <span className="bignum n53 muted">—</span>
                <div className="lq-sub">no levels in this file</div>
              </>
            )}
          </LiquidCard>
        )}
        <LiquidCard i={7} warn={checks > 0} onClick={() => setOpen((o) => !o)}>
          {(e) => (
            <>
              <Lab>Data checks</Lab>
              {checks ? <Num value={checks} e={e} cls="n53" /> : <span className="bignum n53" style={{ color: 'var(--done)' }}>✓</span>}
              <div className="lq-sub">
                <b>{checks ? `to review ${open ? '▴' : '▾'}` : `all passed ${open ? '▴' : '▾'}`}</b>
              </div>
            </>
          )}
        </LiquidCard>
      </div>
      {open && <DataQuality q={q} sum={sum} base={base} scope={base.hs} />}
    </>
  );
}

/* ---------------- HyperScaler cards ---------------- */

/** The 4 base HyperScalers always; others only when this month's file has rows for them. */
export function HsCards({ d, monthLabel }: { d: Dataset; monthLabel: string }) {
  const rows = new Map<string, { total: number; s: Record<St, number> }>();
  for (const e of d.enrollments) {
    let r = rows.get(e.hyperscaler);
    if (!r) rows.set(e.hyperscaler, (r = { total: 0, s: { done: 0, wip: 0, ns: 0 } }));
    r.total++;
    r.s[e.status]++;
  }
  return (
    <div className="hsq">
      {shownHyperscalers(rows.keys()).map((name) => {
        const r = rows.get(name);
        if (!r)
          return (
            <div key={name} className="sq empty">
              <HsLogo name={name} />
              <div className="nm">
                {name}
                <span className="tag-nod">no data</span>
              </div>
              <div className="ct">
                <span className="bignum n42">0</span>
                <small>employees</small>
              </div>
              <div className="sbar" />
              <div className="dn z">No rows in the {monthLabel} file</div>
              <div className="go" style={{ color: 'var(--muted)' }}>
                —
              </div>
            </div>
          );
        return (
          <SnapLink key={name} to={hsUrl(name)} className="sq">
            <HsLogo name={name} />
            <div className="nm">
              {name}
              {!isKnownHyperscaler(name) && (
                <span className="tag-new" title="Not one of the known HyperScalers: added automatically from the uploaded file">
                  new
                </span>
              )}
            </div>
            <div className="ct">
              <span className="bignum n42">{fmtNum(r.total)}</span>
              <small>employees</small>
            </div>
            <StatusBar s={r.s} label={name} />
            <div className={`dn ${r.s.done ? '' : 'z'}`}>{r.s.done ? `✓ ${fmtNum(r.s.done)} completed` : 'none completed yet'}</div>
            <div className="go">View details →</div>
          </SnapLink>
        );
      })}
    </div>
  );
}

