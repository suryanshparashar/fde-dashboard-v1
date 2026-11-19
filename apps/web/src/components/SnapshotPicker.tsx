import { useEffect, useRef, useState } from 'react';
import { useData, useSnapshotParam } from '../hooks/useData';
import { dataMonth, fmtDate, fmtDateTime } from '../lib/format';
import { Icon } from './icons';

/** "Data as of: Latest ▾" — switch the whole app to a previous snapshot. */
export default function SnapshotPicker() {
  const { snapshots, isPast, snapshotId } = useData();
  const { setSnapshot } = useSnapshotParam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!snapshots.length) return null;
  const current = snapshots.find((s) => s.id === snapshotId);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`chip ${isPast ? 'past' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon.History />
        <span className="text-muted">Month</span>
        <b>{snapshotId ? dataMonth(snapshotId) : current ? dataMonth(current.id) : '—'}</b>
        <span className={`mon-tag ${isPast ? 'past' : ''}`}>{isPast ? 'Past' : 'Latest'}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="popover right-0 mt-2 w-[380px] max-h-[420px] overflow-auto p-1.5" role="listbox">
          <div className="k px-3 pt-2 pb-1.5">Monthly uploads · newest first</div>
          {snapshots.map((s, i) => {
            const selected = s.id === snapshotId;
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setSnapshot(i === 0 ? null : s.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 cursor-pointer ${selected ? 'bg-wash' : 'hover:bg-[#f8f9ff]'}`}
              >
                <span className={`w-2 h-2 rounded-full ${selected ? 'bg-brand' : 'bg-line'}`} />
                <span className="flex-1">
                  <span className="font-semibold block">
                    {dataMonth(s.id)} data {i === 0 && <span className="pill i ml-1">Latest</span>}
                  </span>
                  <span className="text-[12px] text-muted">
                    Uploaded {fmtDateTime(s.uploadedAt)} · latest completion {fmtDate(s.dataUpTo)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
