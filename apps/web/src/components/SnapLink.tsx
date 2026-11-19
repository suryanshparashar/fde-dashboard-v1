import { Link, NavLink, useSearchParams, type LinkProps, type NavLinkProps } from 'react-router-dom';

/** Keeps ?snapshot=… when navigating, so a past view stays a past view. */
function useWithSnapshot(to: string) {
  const [params] = useSearchParams();
  const snap = params.get('snapshot');
  if (!snap) return to;
  return `${to}${to.includes('?') ? '&' : '?'}snapshot=${encodeURIComponent(snap)}`;
}

export function SnapLink({ to, ...rest }: Omit<LinkProps, 'to'> & { to: string }) {
  return <Link to={useWithSnapshot(to)} {...rest} />;
}

export function SnapNavLink({ to, ...rest }: Omit<NavLinkProps, 'to'> & { to: string }) {
  return <NavLink to={useWithSnapshot(to)} {...rest} />;
}
