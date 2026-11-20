// Builds local-data/test/fde-sample-oct-2026.xlsx (or the path given as the first argument): one month of user-wise data in the agreed format.
// Columns (in order): Emp ID, Name, Reporting Orgn, Band, HyperScaler, ETA (Date),
//                     Certificate done/WIP, Certification Levels, Email ID
// One row per employee × HyperScaler × level. Deterministic (seeded), so tests can rely on it.
//
// Edge cases included on purpose (fixed Emp IDs E29xxx):
//   E29001  "Certified" status (2 rows)          → the uploader decides
//   E29002  "Foundation" level (1 row)            → the uploader decides
//   E29003  "Oracle Cloud" HyperScaler (3 rows)   → added automatically + flagged
//   E29004  duplicate L1 rows (WIP + Completed)   → furthest kept, flagged
//   E29005  L2 completed, L1 in progress          → cross-check flag (skipped level)
//   E29006  empty Certification Level             → counted as enrollment, not in a level
//   (row)   missing Emp ID                        → row skipped (error)
//   E29007  only L1 row; L2–L4 have no row        → those levels count as Not started
//   E29008  percentage as an Excel number (60%)   → In progress
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'local-data/test/fde-sample-oct-2026.xlsx');
const HEAD = ['Emp ID', 'Name', 'Reporting Orgn', 'Band', 'HyperScaler', 'ETA (Date)', 'Certificate done/WIP', 'Certification Levels', 'Email ID'];

let seed = 20261018; // October file: different seed, so progress differs from November
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const FIRST = ['Aarav', 'Aditi', 'Rohan', 'Isha', 'Kabir', 'Meera', 'Vikram', 'Ananya', 'Arjun', 'Diya', 'Karan', 'Nisha', 'Rahul', 'Sneha', 'Varun', 'Pooja', 'Siddharth', 'Tara', 'Neel', 'Riya'];
const LAST = ['Agarwal', 'Iyer', 'Mehta', 'Rao', 'Singh', 'Nair', 'Kapoor', 'Das', 'Joshi', 'Menon', 'Patel', 'Reddy', 'Bose', 'Kulkarni', 'Shah'];
const ORGS = ['Cloud & Infrastructure', 'Consulting', 'Data & AI', 'Digital Engineering', 'Enterprise Applications', 'Delivery Excellence'];
const BANDS = ['B1', 'B2', 'B3', 'B4', 'B5'];
// Spellings as they may appear in the file → Anthropic / Azure / AWS / Google
const HS = [
  ['Anthropic', 'Claude', 'Anthropic Claude'],
  ['Azure', 'Microsoft Azure', 'MS Azure', 'Microsoft'],
  ['AWS'],
  ['Google'],
];
const LEVEL_TEXT = [['L1', 'Level 1'], ['L2', 'Level-2'], ['L3', 'Level_3'], ['L4', 'level 4']];
const DONE_TEXT = ['Completed', 'Completed', 'completed', 'Done', 'YES'];
const WIP_TEXT = ['WIP', 'WIP', 'In progress', '40%', '75%'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "Wednesday, November 18, 2026" */
const longDate = (d) => `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const serial = (d) => (d.getTime() - Date.UTC(1899, 11, 30)) / 86400000;

const rows = []; // [cells, { etaSerial?: boolean, pct?: number }]
const add = (emp, hs, eta, status, level, opts = {}) =>
  rows.push([[emp.id, emp.name, emp.org, emp.band, hs, eta, status, level, emp.email], opts]);

function person(i, id) {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  return { id, name: `${first} ${last}`, org: ORGS[(i * 5 + 3) % ORGS.length], band: BANDS[(i * 3) % BANDS.length], email: `${first}.${last}${i}@example.com`.toLowerCase() };
}

// ---- 110 regular employees ----
for (let i = 0; i < 110; i++) {
  const emp = person(i, `E${20001 + i}`);
  const count = rnd() < 0.55 ? 1 : rnd() < 0.75 ? 2 : 3;
  const hsIdx = [0, 1, 2, 3].sort(() => rnd() - 0.5).slice(0, count);
  for (const h of hsIdx) {
    const hsText = pick(HS[h]);
    // highest completed level: cumulative (L1 ≥ L2 ≥ L3 ≥ L4)
    const r = rnd();
    const highest = r < 0.3 ? 0 : r < 0.62 ? 1 : r < 0.82 ? 2 : r < 0.94 ? 3 : 4;
    const startedNext = highest < 4 && rnd() < 0.65;
    const lastRow = highest + (startedNext ? 1 : 0) + (rnd() < 0.5 ? 1 : 0); // some files list the next blank level, some don't
    let date = day(2026, 1 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 27));
    for (let lv = 1; lv <= Math.max(1, Math.min(4, lastRow)); lv++) {
      const lvText = pick(LEVEL_TEXT[lv - 1]);
      const asSerial = rnd() < 0.25; // some ETAs are real Excel dates
      if (lv <= highest) {
        date = addDays(date, 20 + Math.floor(rnd() * 40));
        if (date > day(2026, 10, 17)) date = day(2026, 10, 2 + lv);
        add(emp, hsText, asSerial ? serial(date) : longDate(date), pick(DONE_TEXT), lvText, { etaSerial: asSerial });
      } else if (lv === highest + 1 && startedNext) {
        const eta = day(2026, 11, 1 + Math.floor(rnd() * 27));
        const target = rnd() < 0.5 ? eta : addDays(eta, 30 + Math.floor(rnd() * 60)); // Dec 2026 – Feb 2027
        add(emp, hsText, asSerial ? serial(target) : longDate(target), pick(WIP_TEXT), lvText, { etaSerial: asSerial });
      } else {
        add(emp, hsText, '', '', lvText);
      }
    }
  }
}

// ---- edge cases ----
const edge = (n) => person(200 + n, `E2900${n}`);
const e1 = edge(1);
add(e1, 'AWS', longDate(day(2026, 9, 5)), 'Certified', 'L1');
add(e1, 'AWS', longDate(day(2026, 10, 2)), 'Certified', 'L2');
const e2 = edge(2);
add(e2, 'Google', longDate(day(2026, 9, 9)), 'Completed', 'Foundation');
const e3 = edge(3);
add(e3, 'Oracle Cloud', longDate(day(2026, 8, 12)), 'Completed', 'L1');
add(e3, 'Oracle Cloud', longDate(day(2026, 11, 20)), 'WIP', 'L2');
add(e3, 'Oracle Cloud', '', '', 'L3');
const e4 = edge(4);
add(e4, 'Azure', longDate(day(2026, 9, 1)), 'WIP', 'L1');
add(e4, 'Azure', longDate(day(2026, 9, 30)), 'Completed', 'L1');
const e5 = edge(5);
add(e5, 'Anthropic', longDate(day(2026, 11, 15)), 'In progress', 'L1');
add(e5, 'Anthropic', longDate(day(2026, 9, 20)), 'Completed', 'L2');
const e6 = edge(6);
add(e6, 'AWS', longDate(day(2026, 10, 10)), 'Completed', '');
rows.push([['', 'No Id Person', 'Consulting', 'B2', 'AWS', '', 'WIP', 'L1', 'no.id@example.com'], {}]);
const e7 = edge(7);
add(e7, 'Claude', longDate(day(2026, 7, 7)), 'Completed', 'L1');
const e8 = edge(8);
add(e8, 'Google', longDate(day(2026, 12, 20)), 0.6, 'L1', { pct: true });

// ---- write ----
const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows.map(([c]) => c)]);
rows.forEach(([, o], i) => {
  const r = i + 1;
  if (o.etaSerial) ws[XLSX.utils.encode_cell({ r, c: 5 })].z = 'dddd, mmmm dd, yyyy';
  if (o.pct) ws[XLSX.utils.encode_cell({ r, c: 6 })].z = '0%';
});
ws['!cols'] = [10, 20, 24, 6, 16, 30, 20, 18, 34].map((wch) => ({ wch }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Oct 2026');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(`Wrote ${OUT}: ${rows.length} rows`);
