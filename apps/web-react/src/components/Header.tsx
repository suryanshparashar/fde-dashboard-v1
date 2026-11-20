import { useLocation, useNavigate } from 'react-router-dom';
import { SnapLink, SnapNavLink } from './SnapLink';
import SnapshotPicker from './SnapshotPicker';
import { useData } from '../hooks/useData';
import { BRAND } from '../lib/brand';
import { Icon } from './icons';

/**
 * Light single-bar header (design W2): wide wordmark logo · product title · navigation · Month · Upload.
 * The month (and Latest / past) lives in the Month control; the upload time is in the footer and page subtitles.
 */
export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isPast } = useData();
  return (
    <header className="app-hdr">
      <SnapLink to="/" className="app-brand" aria-label={`${BRAND.name}: ${BRAND.product} home`}>
        <img className="app-logo" src={BRAND.logo} alt={`${BRAND.name} logo`} />
      </SnapLink>
      <span className="app-sep" aria-hidden />
      <SnapLink to="/" className="app-title">
        {BRAND.product}
      </SnapLink>
      <nav className="hnav" aria-label="Main">
        <SnapNavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/hs/') ? 'active' : '')}>
          Dashboard
        </SnapNavLink>
        <SnapNavLink to="/people">Employees</SnapNavLink>
        <SnapNavLink to="/uploads">Uploads</SnapNavLink>
      </nav>
      <SnapshotPicker />
      <button className="btn-up" disabled={isPast} title={isPast ? 'Switch to the latest data to upload' : 'Upload the monthly Excel / CSV'} onClick={() => navigate('/upload')}>
        <Icon.Upload /> Upload
      </button>
    </header>
  );
}
