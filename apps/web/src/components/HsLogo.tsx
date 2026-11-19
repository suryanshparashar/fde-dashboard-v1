import { HS_LOGOS, HS_TILES } from '../lib/logos';
import { hsMonogram } from '../lib/hyperscalers';

/** Brand logo tile (Simple Icons) or a lettered tile when there is no icon. */
export function HsLogo({ name, sm }: { name: string; sm?: boolean }) {
  const logo = HS_LOGOS[name];
  const tile = HS_TILES[name];
  const color = logo?.color ?? tile?.color ?? '#1e3a8a';
  return (
    <span className={`hs-logo ${sm ? 'sm' : ''}`} style={{ ['--b' as string]: color }} aria-hidden>
      {logo ? (
        <svg viewBox="0 0 24 24">
          {logo.paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      ) : (
        <span className="mono">{tile?.text ?? hsMonogram(name)}</span>
      )}
    </span>
  );
}
