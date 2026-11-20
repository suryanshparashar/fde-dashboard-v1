const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Icon = {
  Star: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8z" />
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...S} strokeWidth={2.4} aria-hidden>
      <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...S} stroke="#64748B" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  Users: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 100-6M22 21c0-3-2-5-5-5.5" />
    </svg>
  ),
  Award: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 14l-1.5 8 5-3 5 3-1.5-8" />
    </svg>
  ),
  Plus: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...S} strokeWidth={2.2} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Calendar: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" {...S} stroke="#64748B" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  /** 22px clock for stat tiles (WIP). */
  Progress: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden>
      <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...S} aria-hidden>
      <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  ),
  Download: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" {...S} aria-hidden>
      <path d="M12 4v12M6 10l6 6 6-6M4 20h16" />
    </svg>
  ),
  File: () => (
    <svg width="30" height="30" viewBox="0 0 24 24" {...S} stroke="#4F46E5" aria-hidden>
      <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
    </svg>
  ),
};
