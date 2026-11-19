// Renders mockups/fde-cards: final PNG, mid-animation PNG (?f=0.45) and a 5-frame filmstrip per option,
// plus contact-sheet.png. Usage (PowerShell): node scripts/shoot-cards.mjs
import { chromium } from 'playwright-core';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = path.resolve('mockups/fde-cards');
const pages = readdirSync(DIR).filter((f) => /^option-\d-.*\.html$/.test(f)).sort();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch(EDGE ? { executablePath: EDGE } : { channel: 'msedge' });
const errors = [];
const url = (f, q = '') => pathToFileURL(path.join(DIR, f)).href + q;

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
for (const f of pages) {
  const base = f.replace('.html', '');
  await page.goto(url(f));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(DIR, `${base}.png`), fullPage: true });
  await page.goto(url(f, '?f=0.45'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(DIR, `${base}-mid.png`), fullPage: false });
  // measure the big numbers
  const sizes = await page.$$eval('.num.xl, .num.xxl', (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  console.log(base, 'smallest big number:', Math.min(...sizes), 'px');
}

// filmstrips: the status row at 5 moments of the animation
for (const f of pages) {
  const base = f.replace('.html', '');
  const frames = [];
  for (const t of [0.05, 0.25, 0.5, 0.75, 1]) {
    await page.goto(url(f, `?f=${t}`));
    await page.waitForTimeout(120);
    const box = await page.locator('.sec').first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      const n = el.nextElementSibling.getBoundingClientRect();
      return { y: r.top + scrollY, h: n.bottom - r.top };
    });
    frames.push((await page.screenshot({ clip: { x: 0, y: box.y, width: 1440, height: box.h + 12 }, fullPage: true })).toString('base64'));
  }
  const tags = ['start', '25%', '50%', '75%', 'done'];
  const strip = await browser.newPage({ viewport: { width: 1440, height: 400 } });
  await strip.setContent(
    `<body style="margin:0;background:#0f1b3d;font-family:Segoe UI,sans-serif;color:#fff">` +
      frames.map((b64, i) => `<div style="position:relative"><img style="width:1440px;display:block;margin-bottom:6px" src="data:image/png;base64,${b64}"><b style="position:absolute;right:14px;top:10px;background:#0f1b3d;padding:4px 10px;border-radius:6px">${tags[i]}</b></div>`).join('') +
      '</body>',
  );
  await strip.screenshot({ path: path.join(DIR, `${base}-filmstrip.png`), fullPage: true });
  await strip.close();
}

// contact sheet: the top of each final PNG
const cells = pages.map((f) => `<figure><img src="${f.replace('.html', '.png')}"><figcaption>${f.replace(/^option-(\d)-(.*)\.html$/, 'Option $1 · $2')}</figcaption></figure>`).join('');
writeFileSync(path.join(DIR, 'contact.html'), `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#0f1b3d;font-family:'Segoe UI',sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:18px;width:1800px}
figure{margin:0;background:#fff;border-radius:12px;overflow:hidden;height:560px;position:relative}
img{width:100%;display:block}figcaption{position:absolute;left:12px;top:12px;background:#0f1b3d;color:#fff;font-weight:800;font-size:18px;padding:6px 12px;border-radius:8px;text-transform:capitalize}
</style>${cells}`);
const sheet = await browser.newPage({ viewport: { width: 1848, height: 1000 } });
await sheet.goto(pathToFileURL(path.join(DIR, 'contact.html')).href);
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: path.join(DIR, 'contact-sheet.png'), fullPage: true });
rmSync(path.join(DIR, 'contact.html'));

await browser.close().catch(() => {});
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
