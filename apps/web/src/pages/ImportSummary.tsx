import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useSnapshotRows, useSnapshots } from '../hooks/useData';
import { buildDataset } from '../lib/aggregate';
import { downloadText, issuesToCsv } from '../lib/csv';
import { dataMonth, fmtNum, snapshotLabel } from '../lib/format';
import { isSnapshotId } from '../lib/snapshotName';
import { Breadcrumb, DataQuality } from '../components/fde';
import { NumberTile, StatRow } from '../components/fluid';
import { SnapLink } from '../components/SnapLink';
import type { ImportNavState } from './Upload';

export default function ImportSummary() {
  const { id = '' } = useParams();
  const state = useLocation().state as ImportNavState | null;
  const snap = useSnapshotRows(isSnapshotId(id) ? id : null);
  const snapshots = useSnapshots();
  const d = useMemo(() => buildDataset(snap.data?.rows ?? []), [snap.data]);
  const isLatest = snapshots.data?.[0]?.id === id;
  const viewUrl = isLatest ? '/' : `/?snapshot=${id}`;

  if (!isSnapshotId(id)) return <div className="page"><div className="empty big">Unknown upload.</div></div>;
  if (snap.isLoading) return <div className="page muted">Loading…</div>;
  if (snap.error) return <div className="page"><div className="empty big">{(snap.error as Error).message}</div></div>;

  const errors = state?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const warnings = state?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  const tiles: [string, number, string?][] = [
    ['Rows saved', d.rowCount],
    ['Employees', d.summary.employees],
    ['Enrollments', d.summary.total, 'employee × HyperScaler'],
    ['HyperScalers', d.hyperscalers.length],
    ['Levels', d.N],
  ];

  return (
    <>
      <Breadcrumb parts={[{ label: 'Overall', to: '/' }, { label: 'Uploads', to: '/uploads' }, { label: `${dataMonth(id)} data` }]} />
      <div className="page stack">
        <div className="vhead">
          <div>
            <h2>
              {state ? '✓ Saved: ' : ''}
              {dataMonth(id)} data
            </h2>
            <span className="meta">
              Uploaded {snapshotLabel(id)}
              {state && (
                <>
                  {' '}
                  · from <b>{state.fileName}</b> (sheet {state.sheetName})
                </>
              )}{' '}
              · <code>{id}.csv</code>
            </span>
          </div>
          <SnapLink to={viewUrl} className="btn primary ml-auto">
            View the dashboard →
          </SnapLink>
        </div>

        <div className="grid grid-cols-5 gap-[21px]">
          {tiles.map(([k, v, note], i) => (
            <NumberTile key={k} i={i} label={k} value={v} sub={note} />
          ))}
        </div>
        <div className="sec">Status in this month</div>
        <StatRow sum={d.summary} totalLabel="Total enrolled" totalSub={<>{fmtNum(d.summary.employees)} employees</>} />
        <div className="sec">Checks</div>

        {state && (
          <div className="grid2">
            <div className="card">
              <div className="h2">From the upload</div>
              <ul className="mt-2 text-[13.5px] grid gap-1.5">
                <li>
                  <b>{fmtNum(state.rowsSaved)}</b> rows saved
                  {errors > 0 && (
                    <>
                      , <b style={{ color: 'var(--red)' }}>{errors}</b> skipped because of errors
                    </>
                  )}
                  {state.skippedByChoice > 0 && <>, {state.skippedByChoice} skipped by your choice</>}
                  {warnings > 0 && <>, {warnings} warnings</>}.
                </li>
                {state.newHyperscalers.length > 0 && (
                  <li>
                    <span className="tag-new" style={{ marginLeft: 0 }}>
                      flag
                    </span>{' '}
                    New HyperScaler{state.newHyperscalers.length > 1 ? 's' : ''} added automatically: <b>{state.newHyperscalers.join(', ')}</b>
                  </li>
                )}
                {state.decisions.length > 0 && (
                  <li>
                    Your choices (remembered for next time):
                    <ul className="ml-5 mt-1 list-disc muted">
                      {state.decisions.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
              {state.issues.length > 0 && (
                <button className="btn sm ghost mt-3" onClick={() => downloadText(`${id}-issues.csv`, issuesToCsv(state.issues))}>
                  Download all {state.issues.length} row issues (CSV)
                </button>
              )}
            </div>
            <DataQuality q={d.quality} sum={d.summary} base={{}} />
          </div>
        )}
        {!state && <DataQuality q={d.quality} sum={d.summary} base={{}} />}
      </div>
    </>
  );
}
