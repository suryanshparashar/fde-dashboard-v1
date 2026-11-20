// Screenshots of pages after their one-time fill animation has settled.
// Usage (PowerShell): node scripts/settled-shots.mjs <baseUrl> <outDir> <path>=<name> ...
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import path from 'node:path';
const [base, out, ...specs] = process.argv.slice(2);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch(EDGE ? { executablePath: EDGE } : { channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
for (const s of specs) {
  const cut = s.lastIndexOf('=');
  await p.goto(base + s.slice(0, cut));
  await p.waitForTimeout(2600);
  await p.screenshot({ path: path.join(out, `${s.slice(cut + 1)}.png`), fullPage: true });
}
await b.close().catch(() => {});
console.log(errs.length ? errs.join('\n') : 'ok');
