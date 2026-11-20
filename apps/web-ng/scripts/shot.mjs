// node shot.mjs <outDir> <width> <file.html[?query]>=<name> ...
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [out, width, ...pages] = process.argv.slice(2);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch(EDGE ? { executablePath: EDGE } : { channel: 'msedge' });
const p = await b.newPage({ viewport: { width: Number(width), height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
for (const spec of pages) {
  const cut = spec.lastIndexOf('=');
  const file = spec.slice(0, cut), name = spec.slice(cut + 1);
  const [f, q] = file.split('?');
  await p.goto(pathToFileURL(path.resolve(f)).href + (q ? `?${q}` : ''));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
}
await b.close().catch(() => {});
console.log(errs.length ? errs.join('\n') : 'ok');
