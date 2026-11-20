import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CleanRow, Field, RowIssue, St } from '../types';
import { STATUS_LABEL } from '../types';
import { ACCEPTED_EXTENSIONS, defaultSheetIndex, readWorkbook, type ParsedWorkbook } from '../lib/parse';
import { autoMapColumns, FIELDS, missingRequired, type ColumnMapping } from '../lib/columns';
import { validateRows, type UnknownValue } from '../lib/validate';
import { emptyMappings, fetchMappings, saveMappings, type Mappings } from '../lib/mappings';
import { KNOWN_HYPERSCALERS } from '../lib/hyperscalers';
import { runImport } from '../lib/runImport';
import { buildSnapshotId } from '../lib/snapshotName';
import { fmtIso, fmtNum, monthOf } from '../lib/format';
import { useData } from '../hooks/useData';
import { Icon } from '../components/icons';
import { Breadcrumb } from '../components/fde';

export interface ImportNavState {
  fileName: string;
  sheetName: string;
  issues: RowIssue[];
  rowsSaved: number;
  skippedByChoice: number;
  /** Values decided in this upload, e.g. ["Status \"Certified\" → Completed"]. */
  decisions: string[];
  newHyperscalers: string[];
}

interface Loaded {
  file: File;
  wb: ParsedWorkbook;
  sheetIdx: number;
  mapping: ColumnMapping;
}

const merge = (a: Mappings, b: Mappings): Mappings => ({
  status: { ...a.status, ...b.status },
  level: { ...a.level, ...b.level },
  hyperscaler: { ...a.hyperscaler, ...b.hyperscaler },
});

export default function Upload() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isPast, dataset } = useData();
  const saved = useQuery({ queryKey: ['mappings'], queryFn: fetchMappings });
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  /** Decisions made on this screen (saved to mappings.json on import). */
  const [choices, setChoices] = useState<Mappings>(emptyMappings);

  async function onFile(file: File) {
    setReadError(null);
    setImportError(null);
    setChoices(emptyMappings());
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setReadError(`"${file.name}" isn't a spreadsheet. Use one of: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }
    try {
      const wb = readWorkbook(await file.arrayBuffer());
      if (!wb.sheets.length) {
        setReadError('No table found in this file. Make sure it has a header row with the column names.');
        return;
      }
      const sheetIdx = defaultSheetIndex(wb);
      setLoaded({ file, wb, sheetIdx, mapping: autoMapColumns(wb.sheets[sheetIdx].headers) });
    } catch (e) {
      setReadError(`Couldn't read this file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const sheet = loaded ? loaded.wb.sheets[loaded.sheetIdx] : null;
  const missing = loaded ? missingRequired(loaded.mapping) : [];
  const mappings = useMemo(() => merge(saved.data ?? emptyMappings(), choices), [saved.data, choices]);
  const validation = useMemo(
    () => (loaded && sheet && !missing.length && saved.isSuccess ? validateRows(sheet, loaded.mapping, mappings, loaded.wb.date1904, undefined, new Set(Object.keys(saved.data?.hyperscaler ?? {}))) : null),
    [loaded, sheet, missing.length, mappings, saved.isSuccess],
  );
  const errors = validation?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = validation?.issues.filter((i) => i.severity === 'warning') ?? [];
  const undecided = (validation?.unknownStatus.length ?? 0) + (validation?.unknownLevel.length ?? 0);
  const stats = useMemo(() => {
    const rows = validation?.rows ?? [];
    return {
      employees: new Set(rows.map((r) => r.empId.toUpperCase())).size,
      enrollments: new Set(rows.map((r) => `${r.empId.toUpperCase()}|${r.hyperscaler}`)).size,
      hyperscalers: new Set(rows.map((r) => r.hyperscaler)).size,
      levels: rows.reduce((m, r) => Math.max(m, r.level), 0),
    };
  }, [validation]);
  const hsOptions = useMemo(() => [...new Set([...KNOWN_HYPERSCALERS, ...dataset.hyperscalers])], [dataset.hyperscalers]);
  const levelOptions = Math.max(4, stats.levels, dataset.N) + 1;

  async function doImport() {
    if (!loaded || !sheet || !validation || undecided) return;
    setBusy(true);
    setImportError(null);
    try {
      // Remember every decision, including new HyperScalers kept as new.
      const hsDefaults: Record<string, string> = {};
      for (const h of validation.newHyperscalers) hsDefaults[h.key] = choices.hyperscaler[h.key] ?? h.name;
      const toSave = merge(saved.data ?? emptyMappings(), { ...choices, hyperscaler: { ...choices.hyperscaler, ...hsDefaults } });
      await saveMappings(toSave);
      const id = await runImport(validation.rows.map(({ sourceRow: _, ...r }) => r), validation.latestDoneDate);
      await qc.invalidateQueries({ queryKey: ['mappings'] });
      await qc.invalidateQueries({ queryKey: ['snapshots'] });
      await qc.invalidateQueries({ queryKey: ['snapshot', 'latest'] });
      const decisions = [
        ...Object.entries(choices.status).map(([k, v]) => `Status "${k}" → ${v === 'skip' ? 'rows skipped' : STATUS_LABEL[v]}`),
        ...Object.entries(choices.level).map(([k, v]) => `Level "${k}" → ${v === 'skip' ? 'rows skipped' : `L${v}`}`),
        ...validation.newHyperscalers.map((h) => (hsDefaults[h.key] === h.name ? `HyperScaler "${h.raw}" added as new` : `HyperScaler "${h.raw}" → ${hsDefaults[h.key]}`)),
      ];
      const state: ImportNavState = {
        fileName: loaded.file.name,
        sheetName: sheet.name,
        issues: validation.issues,
        rowsSaved: validation.rows.length,
        skippedByChoice: validation.skippedByChoice,
        decisions,
        newHyperscalers: validation.newHyperscalers.filter((h) => hsDefaults[h.key] === h.name).map((h) => h.name),
      };
      navigate(`/uploads/${id}`, { state });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const setMapping = (field: Field, idx: number | null) => loaded && setLoaded({ ...loaded, mapping: { ...loaded.mapping, [field]: idx } });
  const choose = <K extends keyof Mappings>(kind: K, key: string, value: Mappings[K][string] | undefined) =>
    setChoices((c) => {
      const next = { ...c[kind] } as Mappings[K];
      if (value === undefined) delete next[key];
      else next[key] = value;
      return { ...c, [kind]: next };
    });

  return (
    <>
      <Breadcrumb parts={[{ label: 'Overall', to: '/' }, { label: 'Upload monthly sheet' }]} />
      <div className="page">
        <h1 className="title">Upload this month's sheet</h1>
        <div className="sub mt-1">
          One row per employee × HyperScaler × level. The file is saved as <b>{monthOf(new Date())}</b> data (the upload month) in <code>local-data/</code>; earlier
          months stay available in the history.
        </div>

        {isPast && <div className="banner-past rounded-xl mt-4 px-4 py-3">You're viewing past data. Go back to the latest data to upload.</div>}

        <div
          className={`drop mt-5 px-8 ${loaded ? 'py-6' : 'py-10'} ${over ? 'over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void onFile(f);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          aria-label="Choose a spreadsheet to upload"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="hidden"
            data-testid="file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-white mx-auto mb-3.5 grid place-items-center shadow-[0_6px_16px_rgba(29,78,216,.15)]">
            <Icon.File />
          </div>
          <h3 className="text-[18px] font-bold">{loaded ? 'Drop another file to replace' : 'Drag & drop the monthly Excel file here'}</h3>
          <div className="sub">
            or <span className="link">browse files</span> · .xlsx, .xls, .xlsb, .ods, .csv, .tsv
          </div>
          {!loaded && (
            <div className="flex flex-wrap gap-2 justify-center mt-3.5">
              {FIELDS.map((f, i) => (
                <span key={f.field} className="pill i bg-white border border-[#c7d2fe]">
                  {i + 1}. {f.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {readError && <div className="pill r mt-4 !rounded-xl !px-4 !py-3 !text-[13.5px] w-full">{readError}</div>}
        {saved.error && <div className="pill r mt-4 !rounded-xl !px-4 !py-3 !text-[13.5px] w-full">{(saved.error as Error).message}</div>}

        {loaded && sheet && (
          <>
            <div className="panel flex items-center gap-4 px-5 py-4 mt-5">
              <div className="w-[42px] h-[42px] rounded-[10px] bg-[#e7f6ec] grid place-items-center text-[#15803d] font-extrabold text-[12px]">
                {loaded.file.name.split('.').pop()?.toUpperCase().slice(0, 4)}
              </div>
              <div className="flex-1">
                <div className="font-bold">{loaded.file.name}</div>
                <div className="sub text-[12.5px]">
                  {(loaded.file.size / 1024).toFixed(0)} KB · header on row {sheet.headerRowNumber} · {fmtNum(sheet.rows.length)} rows
                  {validation && (
                    <>
                      {' '}
                      · {fmtNum(stats.employees)} employees · {fmtNum(stats.enrollments)} enrollments · {stats.hyperscalers} HyperScalers · {stats.levels} levels
                    </>
                  )}
                </div>
              </div>
              {loaded.wb.sheets.length > 1 && (
                <label className="flex items-center gap-2 text-[13px] text-muted">
                  Sheet
                  <select
                    className="sel"
                    value={loaded.sheetIdx}
                    onChange={(e) => {
                      const sheetIdx = Number(e.target.value);
                      setLoaded({ ...loaded, sheetIdx, mapping: autoMapColumns(loaded.wb.sheets[sheetIdx].headers) });
                    }}
                  >
                    {loaded.wb.sheets.map((s, i) => (
                      <option key={s.name} value={i}>
                        {s.name} ({s.rows.length} rows)
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <span className={`pill ${missing.length || undecided ? 'a' : 'g'}`}>
                {missing.length ? `${missing.length} column(s) to map` : undecided ? `${undecided} value(s) need your decision` : '✓ Ready'}
              </span>
            </div>

            {validation && (undecided > 0 || validation.newHyperscalers.length > 0 || Object.keys(choices.status).length + Object.keys(choices.level).length > 0) && (
              <Decisions
                unknownStatus={validation.unknownStatus}
                unknownLevel={validation.unknownLevel}
                newHs={validation.newHyperscalers}
                choices={choices}
                choose={choose}
                hsOptions={hsOptions}
                levelOptions={levelOptions}
              />
            )}

            <div className="grid grid-cols-[320px_1fr] gap-5 mt-5 items-start">
              <div className="panel p-5">
                <h4 className="font-bold mb-3">Column check</h4>
                {FIELDS.map((f, i) => {
                  const idx = loaded.mapping[f.field];
                  return (
                    <div key={f.field} className="flex justify-between items-center gap-3 py-2 border-b border-[#eef2ff] last:border-0 text-[13.5px]">
                      <span>
                        <span className="text-muted text-[11.5px] mr-1">{i + 1}.</span>
                        {f.label}
                        {!f.required && <span className="text-muted text-[11.5px]"> (optional)</span>}
                      </span>
                      <select
                        className={`text-[12.5px] font-semibold rounded-md border px-1.5 py-1 max-w-[150px] ${idx != null ? 'text-[#16a34a] border-[#bbf7d0] bg-[#f0fdf4]' : f.required ? 'text-[#dc2626] border-[#fecaca] bg-[#fef2f2]' : 'text-muted border-line'}`}
                        value={idx ?? ''}
                        onChange={(e) => setMapping(f.field, e.target.value === '' ? null : Number(e.target.value))}
                        aria-label={`Column for ${f.label}`}
                      >
                        <option value="">{f.required ? '✗ Choose column' : '— Not in file'}</option>
                        {sheet.headers.map((h, hi) => (
                          <option key={hi} value={hi}>
                            ✓ {h || `Column ${hi + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-5 min-w-0">
                <div className="panel overflow-hidden">
                  <div className="px-5 pt-4 pb-3 font-bold">
                    Preview{' '}
                    <span className="sub font-normal">
                      · first {Math.min(8, validation?.rows.length ?? 0)} of {fmtNum(validation?.rows.length ?? 0)} rows ready to save
                    </span>
                  </div>
                  {validation ? (
                    <div className="overflow-x-auto">
                      <table className="data">
                        <thead>
                          <tr>
                            <th>Row</th>
                            {FIELDS.map((f) => (
                              <th key={f.field}>{f.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {validation.rows.slice(0, 8).map((r) => (
                            <PreviewRow key={r.sourceRow} r={r} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-5 pb-5 text-muted">{saved.isLoading ? 'Loading your saved choices…' : 'Map the required columns to see a preview.'}</div>
                  )}
                </div>

                {validation && validation.issues.length > 0 && (
                  <div className="panel overflow-hidden">
                    <div className="px-5 py-3.5 font-bold flex gap-2 items-center">
                      Rows needing attention
                      {errors.length > 0 && <span className="pill r">{errors.length} will be skipped</span>}
                      {warnings.length > 0 && <span className="pill a">{warnings.length} warnings</span>}
                    </div>
                    <table className="data">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Row</th>
                          <th style={{ width: 120 }}>Emp ID</th>
                          <th>Issue</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validation.issues.slice(0, 10).map((i, n) => (
                          <tr key={`${i.row}-${n}`}>
                            <td>#{i.row}</td>
                            <td>{i.empId || '—'}</td>
                            <td>
                              <span className={`pill ${i.severity === 'error' ? 'r' : 'a'}`}>{i.reason}</span>
                            </td>
                            <td className="text-muted">{i.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validation.issues.length > 10 && (
                      <div className="px-5 py-2.5 text-muted text-[12.5px]">+{validation.issues.length - 10} more. Download the full list from the import summary.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {importError && <div className="pill r mt-5 !rounded-xl !px-4 !py-3 !text-[13.5px] w-full">Import failed: {importError}</div>}

            <div className="flex justify-end items-center gap-3 mt-5">
              <span className="sub mr-auto">
                {missing.length
                  ? `Map ${missing.map((m) => m.label).join(', ')} to continue.`
                  : undecided
                    ? `Decide the ${undecided} value(s) above to continue.`
                    : validation && (
                        <>
                          {fmtNum(validation.rows.length)} rows will be saved as <b>{monthOf(new Date())}</b> data:{' '}
                          <code>{buildSnapshotId(validation.latestDoneDate, new Date()).slice(0, 13)}…csv</code>
                        </>
                      )}
              </span>
              <button className="btn ghost" onClick={() => setLoaded(null)}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy || isPast || !validation || !validation.rows.length || undecided > 0} onClick={() => void doImport()}>
                {busy ? 'Saving…' : 'Save this month →'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Decisions({
  unknownStatus,
  unknownLevel,
  newHs,
  choices,
  choose,
  hsOptions,
  levelOptions,
}: {
  unknownStatus: UnknownValue[];
  unknownLevel: UnknownValue[];
  newHs: (UnknownValue & { name: string })[];
  choices: Mappings;
  choose: <K extends keyof Mappings>(kind: K, key: string, value: Mappings[K][string] | undefined) => void;
  hsOptions: string[];
  levelOptions: number;
}) {
  const rowsText = (u: UnknownValue) => `row${u.rows.length > 1 ? 's' : ''} ${u.rows.slice(0, 5).join(', ')}${u.rows.length > 5 ? '…' : ''}`;
  // Values already decided on this screen stay listed so the choice can be changed.
  const statusList = [...unknownStatus, ...Object.keys(choices.status).filter((k) => !unknownStatus.some((u) => u.key === k)).map((k) => ({ key: k, raw: k, count: 0, rows: [] }))];
  const levelList = [...unknownLevel, ...Object.keys(choices.level).filter((k) => !unknownLevel.some((u) => u.key === k)).map((k) => ({ key: k, raw: k, count: 0, rows: [] }))];
  return (
    <div className="decide mt-5 overflow-hidden" role="region" aria-label="Needs your decision">
      <div className="px-5 pt-4 pb-2">
        <div className="h2" style={{ color: '#92400e' }}>
          Needs your decision
        </div>
        <div className="h2-sub" style={{ color: '#78350f' }}>
          These values aren't covered by the rules. Your choice is remembered and applied automatically to future uploads.
        </div>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Column</th>
            <th>Value in file</th>
            <th>Where</th>
            <th style={{ width: 280 }}>Treat as</th>
          </tr>
        </thead>
        <tbody>
          {statusList.map((u) => (
            <tr key={`s-${u.key}`}>
              <td>Certificate done/WIP</td>
              <td>
                <b>"{u.raw}"</b>
              </td>
              <td className="muted">{u.count ? `${u.count} · ${rowsText(u)}` : 'decided'}</td>
              <td>
                <select
                  className={`sel w-full ${choices.status[u.key] ? '' : 'need'}`}
                  value={choices.status[u.key] ?? ''}
                  onChange={(e) => choose('status', u.key, (e.target.value || undefined) as St | 'skip' | undefined)}
                  aria-label={`Status for "${u.raw}"`}
                >
                  <option value="">Choose…</option>
                  <option value="done">Completed</option>
                  <option value="wip">In progress</option>
                  <option value="ns">Not started</option>
                  <option value="skip">Skip these rows</option>
                </select>
              </td>
            </tr>
          ))}
          {levelList.map((u) => (
            <tr key={`l-${u.key}`}>
              <td>Certification Levels</td>
              <td>
                <b>"{u.raw}"</b>
              </td>
              <td className="muted">{u.count ? `${u.count} · ${rowsText(u)}` : 'decided'}</td>
              <td>
                <select
                  className={`sel w-full ${choices.level[u.key] !== undefined ? '' : 'need'}`}
                  value={choices.level[u.key] ?? ''}
                  onChange={(e) => choose('level', u.key, e.target.value === '' ? undefined : e.target.value === 'skip' ? 'skip' : Number(e.target.value))}
                  aria-label={`Level for "${u.raw}"`}
                >
                  <option value="">Choose…</option>
                  {Array.from({ length: levelOptions }, (_, i) => (
                    <option key={i} value={i + 1}>
                      L{i + 1}
                    </option>
                  ))}
                  <option value="skip">Skip these rows</option>
                </select>
              </td>
            </tr>
          ))}
          {newHs.map((h) => (
            <tr key={`h-${h.key}`}>
              <td>
                HyperScaler <span className="tag-new">new</span>
              </td>
              <td>
                <b>"{h.raw}"</b>
              </td>
              <td className="muted">
                {h.count} · {rowsText(h)}
              </td>
              <td>
                <select className="sel w-full" value={choices.hyperscaler[h.key] ?? h.name} onChange={(e) => choose('hyperscaler', h.key, e.target.value === h.name ? undefined : e.target.value)} aria-label={`HyperScaler for "${h.raw}"`}>
                  <option value={h.name}>Add as a new HyperScaler "{h.name}"</option>
                  {hsOptions
                    .filter((o) => o !== h.name)
                    .map((o) => (
                      <option key={o} value={o}>
                        Same as {o}
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewRow({ r }: { r: CleanRow }) {
  return (
    <tr>
      <td className="text-muted">{r.sourceRow}</td>
      <td>{r.empId}</td>
      <td className="whitespace-nowrap">{r.name}</td>
      <td>{r.reportingOrg}</td>
      <td>{r.band}</td>
      <td className="whitespace-nowrap">{r.hyperscaler}</td>
      <td className="whitespace-nowrap">{r.eta ? fmtIso(r.eta) : '—'}</td>
      <td className="whitespace-nowrap">
        <i className={`dot ${r.status} mr-1.5`} />
        {STATUS_LABEL[r.status]}
      </td>
      <td>{r.level ? `L${r.level}` : <span className="muted">—</span>}</td>
      <td>{r.email}</td>
    </tr>
  );
}
