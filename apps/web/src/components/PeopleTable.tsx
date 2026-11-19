import { useMemo, useState, type ReactNode } from 'react';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { Enrollment } from '../lib/aggregate';
import { fmtIso, fmtNum } from '../lib/format';
import { downloadText, toCsv } from '../lib/csv';
import { hsUrl } from '../lib/links';
import { SnapLink } from './SnapLink';

type SortKey = 'empId' | 'name' | 'reportingOrg' | 'band' | 'hyperscaler' | 'status' | 'highest' | 'latestEta';
const ST_ORDER: Record<St, number> = { done: 0, wip: 1, ns: 2 };
const PAGE = 50;

const ST_SHORT: Record<St, string> = { done: '✓', wip: '◐', ns: '–' };

export function LevelStatusChips({ e }: { e: Enrollment }) {
  return (
    <span className="inline-flex gap-1">
      {e.levels.map((s, i) => (
        <span
          key={i}
          className={`st ${s}`}
          title={`L${i + 1}: ${STATUS_LABEL[s]}${e.etas[i] ? ` · ETA ${fmtIso(e.etas[i])}` : ''}`}
          aria-label={`L${i + 1} ${STATUS_LABEL[s]}`}
        >
          L{i + 1}
          <span className="ml-0.5 opacity-80" aria-hidden>
            {ST_SHORT[s]}
          </span>
        </span>
      ))}
    </span>
  );
}

export function exportPeopleCsv(list: Enrollment[], N: number, fileName: string) {
  const levels = Array.from({ length: N }, (_, i) => i + 1);
  const fields = [
    'Emp ID',
    'Name',
    'Email ID',
    'Reporting Orgn',
    'Band',
    'HyperScaler',
    'Status',
    'Highest level completed',
    ...levels.flatMap((l) => [`L${l} status`, `L${l} ETA`]),
  ];
  const data = list.map((e) => [
    e.empId,
    e.name,
    e.email,
    e.reportingOrg,
    e.band,
    e.hyperscaler,
    STATUS_LABEL[e.status],
    e.highest ? `L${e.highest}` : 'None',
    ...e.levels.flatMap((s, i) => [STATUS_LABEL[s], e.etas[i]]),
  ]);
  downloadText(fileName, toCsv(fields, data));
}

export default function PeopleTable({
  list,
  N,
  hideHs,
  toolbar,
  limit,
}: {
  list: Enrollment[];
  N: number;
  /** Hide the HyperScaler column (inside a HyperScaler view). */
  hideHs?: boolean;
  toolbar?: ReactNode;
  /** Show only the first n rows, no pager (embedded use). */
  limit?: number;
}) {
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: 'empId', asc: true });
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    const val = (e: Enrollment): string | number =>
      sort.k === 'status' ? ST_ORDER[e.status] : sort.k === 'highest' ? e.highest : sort.k === 'latestEta' ? e.latestEta || '9999' : e[sort.k].toLowerCase();
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir || a.empId.localeCompare(b.empId, undefined, { numeric: true });
    });
  }, [list, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const p = Math.min(page, pages - 1);
  const rows = limit ? sorted.slice(0, limit) : sorted.slice(p * PAGE, p * PAGE + PAGE);

  const Th = ({ k, children }: { k: SortKey; children: ReactNode }) => (
    <th className={sort.k === k ? 'sorted' : ''} aria-sort={sort.k === k ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button
        onClick={() => {
          setSort((s) => ({ k, asc: s.k === k ? !s.asc : k !== 'highest' }));
          setPage(0);
        }}
      >
        {children}
        {sort.k === k ? (sort.asc ? ' ▴' : ' ▾') : ''}
      </button>
    </th>
  );

  return (
    <div className="panel overflow-hidden">
      {toolbar}
      {!list.length ? (
        <div className="empty m-4">Nobody matches these filters.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <Th k="empId">Emp ID</Th>
                  <Th k="name">Name</Th>
                  <th>Email ID</th>
                  <Th k="reportingOrg">Reporting Orgn</Th>
                  <Th k="band">Band</Th>
                  {!hideHs && <Th k="hyperscaler">HyperScaler</Th>}
                  <Th k="highest">Levels (L1–L{N})</Th>
                  <Th k="status">Status</Th>
                  <Th k="latestEta">Latest ETA</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.key}>
                    <td className="font-mono text-[12.5px]">{e.empId}</td>
                    <td className="font-semibold whitespace-nowrap">{e.name || <span className="muted">—</span>}</td>
                    <td>{e.email ? <a className="link font-normal" href={`mailto:${e.email}`}>{e.email}</a> : <span className="muted">—</span>}</td>
                    <td>{e.reportingOrg || <span className="muted">Not given</span>}</td>
                    <td>{e.band || <span className="muted">Not given</span>}</td>
                    {!hideHs && (
                      <td className="whitespace-nowrap">
                        <SnapLink className="link" to={hsUrl(e.hyperscaler)}>
                          {e.hyperscaler}
                        </SnapLink>
                      </td>
                    )}
                    <td>
                      <LevelStatusChips e={e} />
                    </td>
                    <td className="whitespace-nowrap">
                      <i className={`dot ${e.status} mr-1.5`} />
                      {STATUS_LABEL[e.status]}
                    </td>
                    <td className="whitespace-nowrap">{fmtIso(e.latestEta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!limit && pages > 1 && (
            <div className="pager flex items-center gap-2 justify-end px-4 py-3 border-t border-line text-[13px]">
              <span className="muted mr-auto">
                {fmtNum(p * PAGE + 1)}–{fmtNum(Math.min(sorted.length, (p + 1) * PAGE))} of {fmtNum(sorted.length)}
              </span>
              <button disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page">
                ‹
              </button>
              <span>
                Page {p + 1} of {pages}
              </span>
              <button disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page">
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
