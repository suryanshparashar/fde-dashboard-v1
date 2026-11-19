import { useData } from '../hooks/useData';
import { APP_VERSION, BRAND, copyrightText } from '../lib/brand';
import { dataMonth, snapshotLabel } from '../lib/format';

/** Footer (design F2): logo + copyright on the left; data month, last upload and app version on the right. */
export default function Footer() {
  const { snapshotId, isPast } = useData();
  return (
    <footer className="app-ftr">
      <img className="ftr-logo" src={BRAND.logo} alt="" aria-hidden />
      <span>{copyrightText()}</span>
      <span className="ftr-right">
        {snapshotId && (
          <>
            <span>
              📅 {dataMonth(snapshotId)} data{isPast ? ' (past month)' : ''}
            </span>
            <span>⤒ Uploaded {snapshotLabel(snapshotId)}</span>
          </>
        )}
        {APP_VERSION && <span className="ftr-ver">v{APP_VERSION}</span>}
      </span>
    </footer>
  );
}
