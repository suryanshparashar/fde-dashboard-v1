import type { PeopleFilter } from './aggregate';

/** URL of the employee list with these filters (SnapLink adds ?snapshot= when viewing a past month). */
export function peopleUrl(f: PeopleFilter): string {
  const p = new URLSearchParams();
  if (f.hs !== undefined) p.set('hs', f.hs);
  if (f.org !== undefined) p.set('org', f.org);
  if (f.band !== undefined) p.set('band', f.band);
  if (f.st) p.set('st', f.st);
  if (f.lv !== undefined && f.ls) {
    p.set('lv', String(f.lv));
    p.set('ls', f.ls);
  }
  if (f.hi !== undefined) p.set('hi', String(f.hi));
  if (f.flag) p.set('flag', f.flag);
  const s = p.toString();
  return s ? `/people?${s}` : '/people';
}

export const hsUrl = (name: string) => `/hs/${encodeURIComponent(name)}`;
