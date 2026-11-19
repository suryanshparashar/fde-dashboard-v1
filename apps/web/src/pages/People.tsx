import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import { useData } from '../hooks/useData';
import type { PeopleFilter } from '../lib/aggregate';
import { applyFilter, empKey } from '../lib/aggregate';
import { dataMonth, fmtNum } from '../lib/format';
import { hsUrl } from '../lib/links';
import { Breadcrumb, orNone } from '../components/fde';
import { StatRow } from '../components/fluid';
import { HsLogo } from '../components/HsLogo';
import PeopleTable, { exportPeopleCsv } from '../components/PeopleTable';
import { Icon } from '../components/icons';
import { summarize } from '../lib/aggregate';

const isSt = (v: string | null): v is St => v === 'done' || v === 'wip' || v === 'ns';
const FLAGS = { skip: 'Completed a level above an uncompleted one', dup: 'Has duplicate rows', nolevel: 'Has rows with an empty level' } as const;

/** Read the employee-list filters from the URL. */
function readFilter(p: URLSearchParams): PeopleFilter {
  const f: PeopleFilter = {};
  if (p.has('hs')) f.hs = p.get('hs')!;
  if (p.has('org')) f.org = p.get('org')!;
  if (p.has('band')) f.band = p.get('band')!;
  const st = p.get('st');
  if (isSt(st)) f.st = st;
  const lv = Number(p.get('lv'));
  const ls = p.get('ls');
  if (Number.isInteger(lv) && lv >= 1 && isSt(ls)) {
    f.lv = lv;
    f.ls = ls;
  }
  if (p.has('hi') && Number.isInteger(Number(p.get('hi')))) f.hi = Number(p.get('hi'));
  const flag = p.get('flag');
  if (flag === 'skip' || flag === 'dup' || flag === 'nolevel') f.flag = flag;
  return f;
}

export default function People() {
  const [params, setParams] = useSearchParams();
  const { dataset: d, snapshotId, isLoading, error } = useData();
  const [q, setQ] = useState('');
  const filter = useMemo(() => readFilter(params), [params]);
  const list = useMemo(() => applyFilter(d.enrollments, { ...filter, q }), [d, filter, q]);
  const sum = useMemo(() => summarize(list, d.N), [list, d.N]);
  const employees = useMemo(() => new Set(list.map((e) => empKey(e.empId))).size, [list]);

  const remove = (...keys: string[]) => {
    const p = new URLSearchParams(params);
    keys.forEach((k) => p.delete(k));
    setParams(p);
  };
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v === '__all') p.delete(k);
    else p.set(k, v);
    setParams(p);
  };

  /** Filter chips: HyperScaler (with its logo), status (in its status colour), everything else neutral. */
  type Chip = { label: string; keys: string[]; kind: 'hs' | 'status' | 'other'; st?: St };
  const chips: Chip[] = [];
  if (filter.hs !== undefined) chips.push({ label: `HyperScaler: ${filter.hs}`, keys: ['hs'], kind: 'hs' });
  if (filter.org !== undefined) chips.push({ label: `Reporting Orgn: ${orNone(filter.org)}`, keys: ['org'], kind: 'other' });
  if (filter.band !== undefined) chips.push({ label: `Band: ${orNone(filter.band)}`, keys: ['band'], kind: 'other' });
  if (filter.st) chips.push({ label: `Status: ${STATUS_LABEL[filter.st]}`, keys: ['st'], kind: 'status', st: filter.st });
  if (filter.lv) chips.push({ label: `L${filter.lv}: ${STATUS_LABEL[filter.ls!]}`, keys: ['lv', 'ls'], kind: 'status', st: filter.ls });
  if (filter.hi !== undefined) chips.push({ label: filter.hi ? `Highest completed: L${filter.hi}` : 'No level completed yet', keys: ['hi'], kind: 'other' });
  if (filter.flag) chips.push({ label: FLAGS[filter.flag], keys: ['flag'], kind: 'other' });

  /** Heading = the HyperScaler (or the first other filter); status gets its own coloured badge; the rest is quiet context. */
  const context = chips.filter((c) => c.kind === 'other').map((c) => c.label);
  const heading = filter.hs ?? context[0] ?? 'All employees';
  const contextLine = (filter.hs !== undefined ? context : context.slice(1)).join(' · ');
  const crumbs = [{ label: 'Overall', to: '/' }, ...(filter.hs !== undefined ? [{ label: filter.hs, to: hsUrl(filter.hs) }] : []), { label: 'Employees' }];
  const orgs = useMemo(() => [...new Set(d.enrollments.map((e) => e.reportingOrg))].sort(), [d]);
  const bands = useMemo(() => [...new Set(d.enrollments.map((e) => e.band))].sort(), [d]);

  if (isLoading) return <div className="page muted">Loading…</div>;
  if (error) return <div className="page"><div className="empty big">{error.message}</div></div>;

  const fileName = `employees-${snapshotId ? dataMonth(snapshotId).replace(' ', '-') : 'data'}${chips.length ? '-' + chips.map((c) => c.label.replace(/[^A-Za-z0-9]+/g, '_')).join('-') : ''}.csv`.slice(0, 150);

  return (
    <>
      <Breadcrumb parts={crumbs} />
      <div className="page stack">
        <div className="vhead">
          <div>
            <div className="ph-title">
              {filter.hs !== undefined && <HsLogo name={filter.hs} sm />}
              <h2>{heading}</h2>
              {filter.st && (
                <span key={filter.st} className={`st-badge ${filter.st}`} role="status" aria-label={`Status filter: ${STATUS_LABEL[filter.st]}`}>
                  <i aria-hidden />
                  {STATUS_LABEL[filter.st]}
                </span>
              )}
              {filter.lv && filter.ls && (
                <span key={`${filter.lv}-${filter.ls}`} className={`st-badge ${filter.ls}`} role="status" aria-label={`Level filter: L${filter.lv} ${STATUS_LABEL[filter.ls]}`}>
                  <i aria-hidden />L{filter.lv} · {STATUS_LABEL[filter.ls]}
                </span>
              )}
            </div>
            {contextLine && <div className="ph-context">{contextLine}</div>}
            <span className="meta">
              {fmtNum(list.length)} {list.length === 1 ? 'enrollment' : 'enrollments'} · {fmtNum(employees)} {employees === 1 ? 'employee' : 'employees'} · one row per employee × HyperScaler
            </span>
          </div>
        </div>

        <StatRow
          key={params.toString() + q}
          sum={sum}
          totalLabel="In this list"
          totalSub={<>{fmtNum(employees)} {employees === 1 ? 'employee' : 'employees'} · {fmtNum(list.length)} {list.length === 1 ? 'enrollment' : 'enrollments'}</>}
          active={filter.st}
          to={(k) => {
            const p = new URLSearchParams(params);
            p.delete('snapshot');
            if (filter.st === k) p.delete('st'); // clicking the active status again removes that filter
            else p.set('st', k);
            return `/people?${p.toString()}`;
          }}
        />

        <PeopleTable
          list={list}
          N={d.N}
          toolbar={
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
              <label className="search w-[280px]">
                <Icon.Search />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Emp ID, name, email…" aria-label="Search employees" />
              </label>
              <select className="sel" value={filter.hs ?? '__all'} onChange={(e) => setParam('hs', e.target.value)} aria-label="HyperScaler">
                <option value="__all">All HyperScalers</option>
                {d.hyperscalers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <select className="sel max-w-[200px]" value={filter.org ?? '__all'} onChange={(e) => setParam('org', e.target.value)} aria-label="Reporting Orgn">
                <option value="__all">All Reporting Orgns</option>
                {orgs.map((o) => (
                  <option key={o || '∅'} value={o}>
                    {orNone(o)}
                  </option>
                ))}
              </select>
              <select className="sel" value={filter.band ?? '__all'} onChange={(e) => setParam('band', e.target.value)} aria-label="Band">
                <option value="__all">All Bands</option>
                {bands.map((b) => (
                  <option key={b || '∅'} value={b}>
                    {orNone(b)}
                  </option>
                ))}
              </select>
              <select className={`sel ${filter.st ? `st-sel ${filter.st}` : ''}`} value={filter.st ?? '__all'} onChange={(e) => setParam('st', e.target.value)} aria-label="Status">
                <option value="__all">Any status</option>
                {(['done', 'wip', 'ns'] as St[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <button className="btn sm ghost ml-auto" disabled={!list.length} onClick={() => exportPeopleCsv(list, d.N, fileName)}>
                <Icon.Download /> Export CSV
              </button>
              {chips.length > 0 && (
                <div className="w-full flex flex-wrap gap-2 items-center pt-1">
                  <span className="k">Filters</span>
                  {chips.map((c) => (
                    <span key={c.label} className={`fchip ${c.kind === 'status' ? `st-chip ${c.st}` : c.kind === 'hs' ? 'hs-chip' : ''}`}>
                      {c.kind === 'status' && <i className={`dot ${c.st}`} aria-hidden />}
                      {c.kind === 'hs' && <HsLogo name={filter.hs!} sm />}
                      {c.label}
                      <button onClick={() => remove(...c.keys)} aria-label={`Remove filter ${c.label}`}>
                        ×
                      </button>
                    </span>
                  ))}
                  <button className="link text-[12.5px]" onClick={() => remove('hs', 'org', 'band', 'st', 'lv', 'ls', 'hi', 'flag')}>
                    Clear all
                  </button>
                </div>
              )}
            </div>
          }
        />
        <div className="text-[12px] muted">
          Status = Completed when the top level (L{d.N}) is completed, In progress when any level is started, otherwise Not started. Hover a level chip for its status and
          ETA. ✓ completed · ◐ in progress · – not started.
        </div>
      </div>
    </>
  );
}
