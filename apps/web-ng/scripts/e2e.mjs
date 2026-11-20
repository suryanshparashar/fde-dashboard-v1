// End-to-end check of the running app using the locally installed Microsoft Edge.
// Start the app against an EMPTY throwaway data folder first, so real data is never touched:
//   PowerShell: $env:LOCAL_DATA_DIR='.e2e-data'; npx vite --port 5174
// Then: BASE_URL=http://localhost:5174 LOCAL_DATA_DIR=.e2e-data node scripts/e2e.mjs <screenshot-dir>
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5174';
const DATA = path.resolve(process.env.LOCAL_DATA_DIR ?? '.e2e-data');
const OUT = process.argv[2] ?? 'e2e-screens';
const SAMPLE = path.resolve('src/app/test/fixtures/fde-sample.xlsx'); // the unedited sample (local-data/test/ is yours to edit)
mkdirSync(OUT, { recursive: true });
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

process.on('unhandledRejection', (e) => { if (!/closed/i.test(String(e))) throw e; }); // ignore browser teardown noise
const log = (...a) => console.log('•', ...a);
const errors = [];
const check = (ok, msg) => (ok ? log('ok:', msg) : errors.push(`FAILED: ${msg}`));

const browser = await chromium.launch(EDGE ? { executablePath: EDGE, headless: true } : { channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

try {
  // 0. Empty state
  await page.goto(BASE);
  await page.getByText('No data yet').waitFor();
  await shot('00-empty');

  // 1. Upload: unknown values must be decided first
  await page.goto(`${BASE}/upload`);
  await page.setInputFiles('input[type=file]', SAMPLE);
  await page.getByRole('region', { name: 'Needs your decision' }).waitFor();
  const save = page.getByRole('button', { name: /Save this month/ });
  check(await save.isDisabled(), 'Save is disabled until values are decided');
  check((await page.getByText('Add as a new HyperScaler "Oracle Cloud"').count()) > 0, 'new HyperScaler flagged');
  await shot('01-upload-decide');
  await page.getByLabel('Status for "Certified"').selectOption('done');
  await page.getByLabel('Level for "Foundation"').selectOption('1');
  check(await save.isEnabled(), 'Save enabled after deciding');
  await shot('02-upload-ready');
  await save.click();
  await page.waitForURL(/\/uploads\/\d{6}-\d{6}-\d{6}$/);
  await page.getByText(/Saved:/).waitFor();
  const id1 = page.url().split('/').pop();
  await shot('03-import-summary');
  const saved = JSON.parse(readFileSync(path.join(DATA, 'mappings.json'), 'utf8'));
  check(saved.status.certified === 'done' && saved.level.foundation === 1 && saved.hyperscaler.oraclecloud === 'Oracle Cloud', 'choices saved to mappings.json');
  log('saved', id1);

  // 2. Second upload of the same file: choices are remembered, nothing to decide
  await page.waitForTimeout(1100);
  await page.goto(`${BASE}/upload`);
  await page.setInputFiles('input[type=file]', SAMPLE);
  await page.getByText('Column check').waitFor();
  check((await page.getByRole('region', { name: 'Needs your decision' }).count()) === 0, 're-upload needs no decisions');
  await page.getByRole('button', { name: /Save this month/ }).click();
  await page.waitForURL(/\/uploads\/\d{6}-\d{6}-\d{6}$/);
  const id2 = page.url().split('/').pop();
  check(id2 !== id1, 'second upload saved as its own snapshot');

  // 3. Overview
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Overall' }).waitFor();
  check((await page.getByText('Status per level').count()) === 1, 'status per level card');
  const year = String(new Date().getFullYear());
  check((await page.locator('footer.app-ftr').textContent()).includes(`© ${year}`), 'footer shows the copyright with the current year');
  const hdr = await page.locator('header.app-hdr').evaluate((el) => ({ fits: el.scrollWidth <= el.clientWidth + 1, logo: el.querySelector('img.app-logo').naturalWidth > 0 }));
  check(hdr.fits, 'header fits its width (1440 px)');
  check(hdr.logo, 'header logo loads');
  await page.setViewportSize({ width: 1280, height: 900 });
  check(await page.locator('header.app-hdr').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'header fits at 1280 px');
  await page.setViewportSize({ width: 1440, height: 900 });
  check((await page.getByText(/bottleneck|more than previous/).count()) >= 1, 'funnel flags a step');
  const cardNames = await page.locator('.hsq .nm').allTextContents();
  check(cardNames.slice(0, 4).join('|') === 'Anthropic|Azure|AWS|Google', `base HyperScaler cards first (${cardNames.join(', ')})`);
  check(cardNames.some((n) => n.startsWith('Oracle Cloud') && n.includes('new')), 'unknown HyperScaler gets its own card, flagged new');
  await page.waitForTimeout(2200); // liquid fill runs once, then the page is still
  check((await page.locator('.lq.moving').count()) === 0, 'liquid animation has stopped after load');
  await shot('04-overview');
  await page.locator('a.lq', { hasText: 'In progress' }).click();
  await page.waitForURL(/\/people\?st=wip/);
  log('In progress card → employee list');
  await page.goto(BASE);

  // 4. HyperScaler view via its card, then the stepper
  await page.locator('a.sq', { hasText: 'AWS' }).click();
  await page.waitForURL(/\/hs\/AWS$/);
  check((await page.getByText(/3 of 5/).count()) === 1, 'stepper shows 3 of 5');
  await page.waitForTimeout(2200);
  await shot('05-hs-aws');
  await page.getByRole('link', { name: /Google ›/ }).click();
  await page.waitForURL(/\/hs\/Google$/);
  log('stepper next → Google');
  await page.goto(`${BASE}/hs/Oracle%20Cloud`);
  await page.getByText('added from file').first().waitFor();
  await shot('06-hs-oracle');

  // 5. Employee lists from a level number and from an Org row
  await page.goto(BASE);
  await page.locator('.fl-lvrow .fl-done').nth(1).click();
  await page.waitForURL(/\/people\?lv=2&ls=done/);
  check((await page.getByText('L2: Completed').count()) >= 1, 'level filter chip');
  await page.goto(BASE);
  await page.getByRole('tab', { name: /Band/ }).click();
  check((await page.locator('.bd-row').first().textContent()).startsWith('B'), 'breakdown toggles to Band');
  await page.getByRole('tab', { name: /Reporting Orgn/ }).click();
  await page.locator('.bd-row').first().click();
  await page.waitForURL(/\/people\?org=/);
  await shot('07-people-org');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export CSV/ }).click()]);
  const csv = readFileSync(await dl.path(), 'utf8');
  check(csv.startsWith('Emp ID,Name,Email ID,Reporting Orgn,Band,HyperScaler,Status'), 'export CSV header');
  check(csv.trim().split('\n').length > 2, 'export CSV has rows');

  // 6. Data checks link → flagged employees
  await page.goto(BASE);
  await page.getByRole('button', { name: /Data checks/ }).click();
  await shot('08a-data-checks-open');
  await page.locator('.dq a').first().click();
  await page.waitForURL(/flag=/);
  await shot('08-people-flag');

  // 7. Past month via the picker
  await page.goto(BASE);
  await page.getByRole('button', { name: /^Month/ }).click();
  await page.getByRole('option').nth(1).click();
  await page.getByText(/You're viewing/).waitFor();
  check(page.url().includes(`snapshot=${id1}`), 'past snapshot selected');
  await page.locator('.subtabs a', { hasText: 'Google' }).click();
  check(page.url().includes(`snapshot=${id1}`), 'past snapshot kept when navigating');
  await shot('09-past-google');

  // 8. Uploads page
  await page.goto(`${BASE}/uploads`);
  await page.locator('table.data tbody tr').nth(1).waitFor();
  check((await page.locator('table.data tbody tr').count()) === 2, 'uploads lists 2 months');
  await shot('10-uploads');
} catch (e) {
  errors.push(`exception: ${e.message}`);
  await shot('zz-failure').catch(() => {});
}

await browser.close().catch(() => {});
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
log('all checks passed');
