import { useData, useSnapshotParam } from '../hooks/useData';
import { dataMonth, snapshotLabel } from '../lib/format';

export default function PastViewBanner() {
  const { isPast, snapshotId } = useData();
  const { setSnapshot } = useSnapshotParam();
  if (!isPast || !snapshotId) return null;
  return (
    <div className="banner-past" role="status">
      <div className="max-w-[1480px] mx-auto px-10 py-2.5 flex items-center gap-3 text-[13.5px]">
        <span aria-hidden>🕓</span>
        <span>
          You're viewing <b>{dataMonth(snapshotId)}</b> data (uploaded {snapshotLabel(snapshotId)}). It's read-only, and uploading is off until you go back to the
          latest data.
        </span>
        <button className="btn sm ghost ml-auto" onClick={() => setSnapshot(null)}>
          Back to latest →
        </button>
      </div>
    </div>
  );
}
