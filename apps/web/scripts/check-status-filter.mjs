// Screens the Employees page with a HyperScaler + status filter, before and after changing the status.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import path from 'node:path';
const [BASE = 'http://localhost:5174', OUT = '.'] = process.argv.slice(2);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch(EDGE ? { executablePath: EDGE } : { channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${BASE}/people?hs=AWS&st=wip`);
await p.waitForTimeout(2600);
await p.screenshot({ path: path.join(OUT, 'status-filter-wip.png'), clip: { x: 0, y: 0, width: 1440, height: 640 } });
await p.locator('a.lq', { hasText: 'Completed' }).click();
await p.waitForURL(/st=done/);
await p.waitForTimeout(2600);
await p.screenshot({ path: path.join(OUT, 'status-filter-done.png'), clip: { x: 0, y: 0, width: 1440, height: 640 } });
const badge = await p.locator('.st-badge').textContent();
await p.locator('a.lq.selected').click(); // click the active status again → filter removed
await p.waitForURL((u) => !u.searchParams.has('st'));
console.log(JSON.stringify({ badgeAfterSwitch: badge, filterClearedOnSecondClick: true, url: p.url() }));
await b.close().catch(() => {});
