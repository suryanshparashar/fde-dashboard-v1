// Read-only sweep: opens every page of a running app and reports page errors, console errors and failed requests.
// Nothing is clicked or uploaded. Usage: node scripts/check-pages.mjs [baseUrl]   (default http://localhost:9009)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:9009';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch(EDGE ? { executablePath: EDGE } : { channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
let where = '';
p.on('pageerror', (e) => problems.push(`${where} pageerror: ${e.message}`));
p.on('console', (m) => m.type() === 'error' && problems.push(`${where} console: ${m.text()}`));
p.on('requestfailed', (r) => problems.push(`${where} request failed: ${r.url()} (${r.failure()?.errorText})`));
p.on('response', (r) => r.status() >= 400 && problems.push(`${where} HTTP ${r.status()}: ${r.url()}`));

const snaps = await (await fetch(`${BASE}/api/snapshots`)).json();
const id = snaps[0]?.name.replace('.csv', '');
const routes = ['/', '/hs/Anthropic', '/hs/Azure', '/hs/AWS', '/hs/Google', '/people', '/people?hs=AWS&st=wip', '/people?lv=2&ls=done', '/upload', '/uploads', ...(id ? [`/uploads/${id}`] : [])];
for (const r of routes) {
  where = r;
  await p.goto(BASE + r);
  await p.waitForTimeout(1800);
  const info = await p.evaluate(() => ({
    h: document.querySelector('header.app-hdr') !== null,
    f: document.querySelector('footer.app-ftr') !== null,
    fits: (() => { const h = document.querySelector('header.app-hdr'); return h ? h.scrollWidth <= h.clientWidth + 1 : false; })(),
    title: document.querySelector('.vhead h2, h1.title')?.textContent?.trim() ?? '',
  }));
  console.log(`${r.padEnd(26)} header:${info.h ? '✓' : '✗'} footer:${info.f ? '✓' : '✗'} fits:${info.fits ? '✓' : '✗'}  "${info.title}"`);
}
await b.close().catch(() => {});
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nno errors on any page');
