import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../hooks/useData';
import type { Dataset, PeopleFilter } from '../lib/aggregate';
import { applyFilter, groupBy, subsetQuality, summarize } from '../lib/aggregate';
import { fmtNum, dataMonth, snapshotLabel } from '../lib/format';
import { peopleUrl } from '../lib/links';
import { isBaseHyperscaler, isKnownHyperscaler, shownHyperscalers } from '../lib/hyperscalers';
import { Breadcrumb, HsTabs, NewTag, Stepper } from '../components/fde';
import { BreakdownCard, FunnelGlasses, HighestCard, LevelStatusCard } from '../components/fluid';
import { HsCards, HsLogo, InsightCards, StatusCards } from '../components/liquid';
import PeopleTable from '../components/PeopleTable';
import { SnapLink } from '../components/SnapLink';

/** Loading / error / no-data wrapper shared by the dashboard views. */
function Gate({ children }: { children: (d: Dataset, snapshotId: string) => ReactNode }) {
  const { dataset, isLoading, error, snapshotId } = useData();
  if (isLoading) return <div className="page muted">Loading…</div>;
  if (error)
    return (
      <div className="page">
        <div className="empty big">
          <b>Couldn't load the data</b>
          <span>{error.message}</span>
        </div>
      </div>
    );
  if (!snapshotId || !dataset.enrollments.length)
    return (
      <div className="page">
        <div className="empty big">
          <span style={{ fontSize: 28 }}>○</span>
          <b>No data yet</b>
          <span>Upload this month's sheet (Emp ID, Name, Reporting Orgn, Band, HyperScaler, ETA (Date), Certificate done/WIP, Certification Levels, Email ID).</span>
          <SnapLink to="/upload" className="btn primary mt-2">
            Upload the monthly sheet →
          </SnapLink>
        </div>
      </div>
    );
  return <>{children(dataset, snapshotId)}</>;
}

/** Levels and breakdown, in the fluid design: the same for Overall and each HyperScaler. */
function Body({ d, base, unit }: { d: Dataset; base: PeopleFilter; unit: string }) {
  const list = useMemo(() => applyFilter(d.enrollments, base), [d, base]);
  const sum = useMemo(() => summarize(list, d.N), [list, d.N]);
  const orgs = useMemo(() => groupBy(list, 'reportingOrg'), [list]);
  const bands = useMemo(() => groupBy(list, 'band'), [list]);
  return (
    <>
      <div className="sec">Levels</div>
      {d.N > 0 ? (
        <>
          <FunnelGlasses sum={sum} N={d.N} base={base} unit={unit} />
          <div className="grid2">
            <LevelStatusCard sum={sum} N={d.N} base={base} unit={unit} />
            <HighestCard sum={sum} N={d.N} base={base} unit={unit} />
          </div>
        </>
      ) : (
        <div className="empty">
          <span style={{ fontSize: 20 }}>○</span>
          <div>
            <b>No Certification Levels in this file.</b> Every row has an empty level, so per-level status can't be shown.
          </div>
        </div>
      )}
      <div className="sec">Breakdown</div>
      <BreakdownCard orgs={orgs} bands={bands} base={base} multi={!base.hs} />
    </>
  );
}

const OVERALL: PeopleFilter = {};

export function Overview() {
  return (
    <Gate>
      {(d, snapshotId) => (
        <>
          <HsTabs dataset={d} active={null} />
          <div className="page stack">
            <div className="vhead">
              <h2>Overall</h2>
              <span className="meta">
                {dataMonth(snapshotId)} data · uploaded {snapshotLabel(snapshotId)} · {d.hyperscalers.length} HyperScalers with data · {d.N} levels · {fmtNum(d.rowCount)} rows in the file
              </span>
            </div>
            <div className="sec">Status</div>
            <StatusCards sum={d.summary} base={OVERALL} />
            <div className="sec">Key insights</div>
            <InsightCards sum={d.summary} q={d.quality} base={OVERALL} />
            <div className="sec">HyperScalers</div>
            <HsCards d={d} monthLabel={dataMonth(snapshotId)} />
            <Body d={d} base={OVERALL} unit="enrollments" />
          </div>
        </>
      )}
    </Gate>
  );
}

export function HyperScalerView() {
  const { name = '' } = useParams();
  const base = useMemo<PeopleFilter>(() => ({ hs: name }), [name]);
  return (
    <Gate>
      {(d, snapshotId) => {
        const shown = shownHyperscalers(d.hyperscalers);
        const hasData = d.hyperscalers.includes(name);
        const head = (meta: string) => (
          <>
            <HsTabs dataset={d} active={name} />
            <Breadcrumb parts={[{ label: 'Overall', to: '/' }, { label: name }]} />
            <div className="page stack" style={{ paddingBottom: 0 }}>
              <div className="vhead">
                <HsLogo name={name} sm />
                <div>
                  <h2>
                    {name}
                    <NewTag name={name} />
                  </h2>
                  <span className="meta">{meta}</span>
                </div>
                {shown.includes(name) && <Stepper list={shown} current={name} />}
              </div>
            </div>
          </>
        );
        if (!hasData)
          return (
            <>
              {head(isBaseHyperscaler(name) ? 'HyperScaler · no rows this month' : 'Not in this month’s data')}
              <div className="page">
                <div className="empty big">
                  <span style={{ fontSize: 28 }}>○</span>
                  <b>
                    {isBaseHyperscaler(name) || isKnownHyperscaler(name) ? `No ${name} rows in the ${dataMonth(snapshotId)} file.` : `${name} isn't in this month's data.`}
                  </b>
                  <SnapLink to="/" className="link">
                    ← Back to Overall
                  </SnapLink>
                </div>
              </div>
            </>
          );
        const list = applyFilter(d.enrollments, base);
        const sum = summarize(list, d.N);
        const quality = subsetQuality(list, sum, d.quality.profileConflicts);
        return (
          <>
            {head(`HyperScaler · ${fmtNum(sum.total)} employees · ${d.N} levels`)}
            <div className="page stack">
              <div className="sec" style={{ marginTop: 0 }}>
                Status
              </div>
              <StatusCards sum={sum} base={base} parent={d.summary} />
              <div className="sec">Key insights</div>
              <InsightCards sum={sum} q={quality} base={base} parent={d.summary} />
              <Body d={d} base={base} unit="employees" />
              <div>
                <div className="flex items-end gap-3 mb-2.5">
                  <div>
                    <div className="h2">Employees on {name}</div>
                    <div className="h2-sub">First 10 by Emp ID · Emp ID, Email ID and the status of every level</div>
                  </div>
                  <SnapLink to={peopleUrl(base)} className="btn sm ghost ml-auto">
                    Open the full list ({fmtNum(list.length)}) ›
                  </SnapLink>
                </div>
                <PeopleTable list={list} N={d.N} hideHs limit={10} />
              </div>
            </div>
          </>
        );
      }}
    </Gate>
  );
}
