# Build prompt: AI Academy FDE Dashboard

You are building a complete web application from this specification. Build **exactly** what is described here: the same files, names, rules, wording, colours, layout and behaviour. Do not add features, pages, libraries, dark mode, authentication or a backend beyond what is written. Where this document gives code or text verbatim (the appendices and quoted strings), copy it character for character. Every user-facing string in quotes below is the exact UI copy.

---

## 1. What the app is

**AI Academy FDE Dashboard** is a single-page **Angular 17** + TypeScript dashboard (standalone components, signals, the new `@if`/`@for` control flow). It lives in `apps/web-ng/`, and its storage API is a separate, dependency-free Node server in `apps/api/`. The dashboard that tracks employees' certification progress across "HyperScalers" (cloud/AI vendors: Anthropic, Azure, AWS, Google, …) and certification levels (L1–L4).

- Every month an admin uploads one spreadsheet (Excel/CSV). It has one row per **employee × HyperScaler × level**.
- The app parses, normalizes and validates the sheet. Values the built-in rules don't cover are sent to the uploader to decide, and those choices are remembered.
- Each upload is saved as an immutable CSV **snapshot** in `apps/api/local-data/`. One snapshot is one month of data, and months are never merged.
- The dashboard shows:
  - an Overall view;
  - one view per HyperScaler;
  - an Employees list with filters, search and CSV export;
  - the upload history and per-upload summaries;
  - a read-only "past month" mode.
- There is no database. A tiny Node HTTP server (`apps/api/server.mjs`, port 9010) stores files on disk and exposes a small REST API (`/api/snapshots`, `/api/mappings`). The Angular dev server (port 4200) proxies `/api` to it.
- The visual language is "liquid / fluid":
  - Cards fill like glasses once on load, then stay still.
  - A gentle wave slosh plays only while hovered.
  - Numbers are big and semibold, set in the Manrope font, on a golden-ratio type/spacing scale.
- Status colours are fixed and never reused for anything else:
  - Completed: green `#16A34A`
  - In progress: blue `#2563EB`
  - Not started: grey `#94A3B8`
- Levels use an indigo ramp generated for any number of levels N.

Design principles:
- Big numbers, readable without eye strain. No clutter, no small text, but every insight is kept (as a big number plus a few words).
- There are no donut/pie charts and no badges or hexagons. 100 % stacked bars are used instead.
- A row showing **›** navigates, and the whole row is clickable.
- Continuous animation is not allowed; motion happens only on load and on hover. `prefers-reduced-motion` disables it entirely.

---

## 2. Tech stack (exact)

`apps/web-ng/package.json`:

```json
{
  "name": "web-ng",
  "version": "0.1.0",
  "scripts": {
    "ng": "ng",
    "start": "concurrently -k -n api,web -c cyan,blue \"node ../api/server.mjs\" \"ng serve\"",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "start:web": "ng serve",
    "start:api": "node ../api/server.mjs",
    "test:lib": "vitest run",
    "typecheck": "tsc -p tsconfig.app.json --noEmit",
    "sample": "node scripts/make-fde-sample.mjs"
  },
  "private": true,
  "dependencies": {
    "@angular/animations": "^17.3.0",
    "@angular/common": "^17.3.0",
    "@angular/compiler": "^17.3.0",
    "@angular/core": "^17.3.0",
    "@angular/forms": "^17.3.0",
    "@angular/platform-browser": "^17.3.0",
    "@angular/platform-browser-dynamic": "^17.3.0",
    "@angular/router": "^17.3.0",
    "@fontsource-variable/manrope": "^5.1.1",
    "papaparse": "^5.4.1",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
    "zod": "^3.23.8",
    "zone.js": "~0.14.3"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.3.12",
    "@angular/cli": "^17.3.12",
    "@angular/compiler-cli": "^17.3.0",
    "@types/jasmine": "~5.1.0",
    "@types/node": "^20.17.10",
    "@types/papaparse": "^5.3.15",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.0",
    "jasmine-core": "~5.1.0",
    "karma": "~6.4.0",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "playwright-core": "^1.49.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.4.2",
    "vitest": "^2.1.8"
  }
}
```

`apps/api/package.json` (the API server has **no dependencies**):

```json
{
  "name": "fde-api",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Local API for the AI Academy FDE Dashboard: stores monthly snapshots in ./local-data",
  "scripts": { "start": "node server.mjs" }
}
```

- **Angular 17.3**:
  - every component is `standalone: true`; there are no NgModules;
  - templates use the built-in control flow (`@if`, `@else if`, `@for … track`, `@switch`);
  - state is held in **signals** (`signal`, `computed`, `effect`, `toSignal`);
  - bootstrapping is `bootstrapApplication` with `provideRouter(routes, withComponentInputBinding())`;
  - Zone.js is used, but no `@angular/forms` APIs; inputs are bound with `[value]` and `(input)`/`(change)`;
  - no component has its own `styles`; everything is in the global stylesheet.
- **Tailwind CSS v3** (PostCSS through the Angular builder), plus the large hand-written global stylesheet `src/styles.css` (Appendix A). Tailwind utilities are used only for small layout helpers in templates. `tailwind.config.js` adds the same colour names as the CSS tokens.
- SheetJS (`xlsx` 0.20.3 from the SheetJS CDN tarball) reads spreadsheets, PapaParse reads and writes CSV (allowed as a CommonJS dependency in `angular.json`), and Zod validates emails.
- Font: Manrope Variable from `@fontsource-variable/manrope`, added to the `styles` array in `angular.json`.
- Tests: the framework-free logic in `src/app/lib` is tested with **Vitest** (`npm run test:lib`). The Karma/Jasmine `ng test` set-up is left as the CLI generated it, with no spec files. Browser scripts use `playwright-core` driving the locally installed Microsoft Edge.

---

## 3. Repository layout

```
.gitignore
README.md
apps/
  api/
    package.json
    server.mjs              (Appendix F)
    local-data/             (snapshots + mappings.json, created at runtime, git-ignored)
  web-ng/
    .editorconfig  .gitignore  README.md (Angular CLI default)
    .vscode/  extensions.json  launch.json  tasks.json   (Angular CLI defaults)
    angular.json  proxy.conf.json  tailwind.config.js  vitest.config.mjs
    package.json  tsconfig.json  tsconfig.app.json  tsconfig.spec.json
    scripts/
      make-fde-sample.mjs  make-fde-sample-oct.mjs  e2e.mjs  check-pages.mjs  settled-shots.mjs  shot.mjs
    src/
      index.html  main.ts  styles.css  favicon.svg
      assets/  .gitkeep  brand/logo.svg
      app/
        app.component.ts  app.config.ts  app.routes.ts  types.ts
        core/  data.service.ts  fill.ts  snap-link.directive.ts
        lib/   aggregate.ts api.ts brand.ts columns.ts csv.ts format.ts hyperscalers.ts
               levelConfig.ts levels.ts links.ts logos.ts mappings.ts parse.ts rules.ts
               runImport.ts snapshotName.ts validate.ts
        ui/    basics.ts  liquid.ts  fluid.ts  shell.ts
        pages/ views.ts  people.ts  upload.ts  uploads.ts
        test/  aggregate.test.ts pipeline.test.ts rules.test.ts snapshotName.test.ts
               fixtures/fde-sample.xlsx   (generated by scripts/make-fde-sample.mjs)
mockups/   (git-ignored design mockups; not part of the app)
```

`src/app/lib/*` and `src/app/types.ts` are **plain TypeScript with no Angular imports**, so Vitest can test them in Node. Everything in §6–§9 lives there.

Repo-root `.gitignore`:

```
node_modules
dist
local-data/*
!local-data/.gitkeep
*.tsbuildinfo

.e2e-data

mockups/
local-data/
zzz.md
```

`apps/web-ng/.gitignore` and `.editorconfig` are the Angular CLI 17 defaults. `.editorconfig` uses 2-space indents, UTF-8, a final newline, and `quote_type = single` for `*.ts`.

---

## 4. Config files (verbatim)

`apps/web-ng/angular.json`:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "npm", "analytics": false },
  "newProjectRoot": "projects",
  "projects": {
    "web-ng": {
      "projectType": "application",
      "schematics": {},
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/web-ng",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.svg", "src/assets"],
            "styles": ["node_modules/@fontsource-variable/manrope/index.css", "src/styles.css"],
            "scripts": [],
            "allowedCommonJsDependencies": ["papaparse"]
          },
          "configurations": {
            "production": {
              "budgets": [
                { "type": "initial", "maximumWarning": "800kb", "maximumError": "1.5mb" },
                { "type": "anyComponentStyle", "maximumWarning": "2kb", "maximumError": "4kb" }
              ],
              "outputHashing": "all"
            },
            "development": { "optimization": false, "extractLicenses": false, "sourceMap": true }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "configurations": {
            "production": { "buildTarget": "web-ng:build:production" },
            "development": { "buildTarget": "web-ng:build:development" }
          },
          "defaultConfiguration": "development",
          "options": { "proxyConfig": "proxy.conf.json", "port": 4200 }
        },
        "extract-i18n": {
          "builder": "@angular-devkit/build-angular:extract-i18n",
          "options": { "buildTarget": "web-ng:build" }
        },
        "test": {
          "builder": "@angular-devkit/build-angular:karma",
          "options": {
            "polyfills": ["zone.js", "zone.js/testing"],
            "tsConfig": "tsconfig.spec.json",
            "assets": ["src/favicon.svg", "src/assets"],
            "styles": ["node_modules/@fontsource-variable/manrope/index.css", "src/styles.css"],
            "scripts": []
          }
        }
      }
    }
  }
}
```

`apps/web-ng/proxy.conf.json`:

```json
{
  "/api": { "target": "http://localhost:9010", "secure": false, "changeOrigin": true }
}
```

`apps/web-ng/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} — same colour names as the React app (bg-brand, text-muted, border-line, bg-wash…). */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ["'Manrope Variable'", "'Segoe UI'", 'system-ui', 'sans-serif'] },
      colors: { brand: '#1d4ed8', ink: '#0f1b3d', muted: '#6b7690', line: '#e3e8f2', wash: '#eef2ff' },
    },
  },
  plugins: [],
};
```

`apps/web-ng/vitest.config.mjs`:

```js
// Unit and pipeline tests for the framework-free logic in src/app/lib (run with `npm run test:lib`).
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/app/test/**/*.test.ts'], environment: 'node' } });
```

`apps/web-ng/tsconfig.json`:

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "outDir": "./dist/out-tsc",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "declaration": false,
    "experimentalDecorators": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "useDefineForClassFields": false,
    "lib": ["ES2022", "dom"]
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

`tsconfig.app.json` extends it with `outDir ./out-tsc/app`, `types: []`, `files: ["src/main.ts"]` and `include: ["src/**/*.d.ts"]`. `tsconfig.spec.json` extends it with `outDir ./out-tsc/spec`, `types: ["jasmine"]` and `include: ["src/**/*.spec.ts", "src/**/*.d.ts"]`. `noPropertyAccessFromIndexSignature` is on, so index-signature objects are read with bracket access where needed.

`src/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AI Academy FDE Dashboard</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

`src/main.ts`:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

`src/app/app.config.ts`: `providers: [provideRouter(routes, withComponentInputBinding())]`.

`src/app/app.routes.ts`: pages load on demand with `loadComponent`, so the spreadsheet reader is downloaded only with the Upload page. Each route sets a document `title`:

| Path | Component (file) | Title |
|---|---|---|
| `''` (pathMatch full) | `OverviewPage` (pages/views) | `AI Academy FDE Dashboard` |
| `hs/:name` | `HyperScalerPage` (pages/views) | `HyperScaler · AI Academy FDE Dashboard` |
| `people` | `PeoplePage` (pages/people) | `Employees · AI Academy FDE Dashboard` |
| `upload` | `UploadPage` (pages/upload) | `Upload · AI Academy FDE Dashboard` |
| `uploads` | `UploadsPage` (pages/uploads) | `Uploads · AI Academy FDE Dashboard` |
| `uploads/:id` | `ImportSummaryPage` (pages/uploads) | `Upload summary · AI Academy FDE Dashboard` |
| `**` | `redirectTo: ''` | |

`src/app/app.component.ts` (selector `app-root`) has this template:

```html
<div class="app-shell">
  <app-header />
  <app-past-banner />
  <main class="app-main"><router-outlet /></main>
  <app-footer />
</div>
```

How to run: `cd apps/web-ng && npm install && npm start`. This starts the API on 9010 and `ng serve` on http://localhost:4200 together, via `concurrently`. The API server needs no `npm install`.

---

## 5. Storage API: `apps/api/server.mjs`

Copy Appendix F verbatim. It is a plain `node:http` server with no dependencies. Behaviour:

- `PORT` defaults to `9010`. The data dir is `$LOCAL_DATA_DIR`, else `apps/api/local-data`, resolved relative to the script's own folder. The script logs `FDE API on http://localhost:{PORT} · data in {dir}` on start.
- The request path has its query string and trailing slashes stripped. Anything other than `/api/snapshots[/…]` or `/api/mappings` returns `404 { error: 'Not found' }`, and an unsupported method returns `405 { error: 'Method not allowed' }`.
- Snapshot file name regex: `^(\d{6})-(\d{6})-(\d{6})\.csv$`. The name is `{latest completion date ddmmyy}-{upload date ddmmyy}-{upload time hhmmss}.csv`.
- `GET /api/snapshots` returns a JSON array of `{ name, dataUpTo, uploadedOn, uploadedAt, sizeBytes }`, newest upload first. The sort key is yymmdd of the upload date plus hhmmss.
- `GET /api/snapshots/latest`:
  - returns the CSV text of the newest snapshot, with header `X-Snapshot-Name`;
  - returns `204` when there are none.
- `GET /api/snapshots/:name` returns the CSV text. It answers `400` "Invalid snapshot name" and `404` "Snapshot not found".
- `POST /api/snapshots` takes the body `{ name, content }`.
  - It validates the name and requires string content ("Missing content").
  - It **never overwrites**: an existing name returns `409` "Snapshot already exists".
  - It writes atomically to `${target}.${pid}.tmp`, then renames, and returns `201 { name }`.
  - The body limit is 25 MB.
- `GET /api/mappings` returns `local-data/mappings.json`, or `204` if missing.
- `PUT /api/mappings`:
  - requires a JSON object (otherwise `400` "Expected a JSON object");
  - writes it pretty-printed (2 spaces) atomically and returns `{ ok: true }`.
- Every response sets `Cache-Control: no-store` and `Content-Type: … ; charset=utf-8`. Invalid JSON (`SyntaxError`) returns `400 { error }`, and other errors return `500 { error }`.

## 6. Data model: `src/app/types.ts`

```ts
/** Status of one level row: Completed / In progress / Not started. */
export type St = 'done' | 'wip' | 'ns';
export const STATUS_LABEL: Record<St, string> = { done: 'Completed', wip: 'In progress', ns: 'Not started' };

/** One normalized row = one employee × one HyperScaler × one level. Also one snapshot CSV row. */
export interface DataRow {
  empId: string; name: string; reportingOrg: string; band: string;
  hyperscaler: string;   // canonical name
  eta: string;           // ISO yyyy-mm-dd or ''
  status: St;
  level: number;         // 1,2,3…; 0 when the level cell was empty
  email: string;
}
export type CleanRow = DataRow & { sourceRow: number };
export type Field = 'empId' | 'name' | 'reportingOrg' | 'band' | 'hyperscaler' | 'eta' | 'status' | 'level' | 'email';
export interface RowIssue { row: number; empId: string; reason: string; severity: 'error' | 'warning'; value?: string; }
export interface SnapshotInfo { id: string; dataUpTo: Date; uploadedAt: Date; sizeBytes: number; }
```

Terminology used everywhere:
- An **enrollment** is one employee on one HyperScaler.
- An **employee** is counted once, keyed by `empId.trim().toUpperCase()` (`empKey`).

---

## 7. The monthly sheet

There are 9 columns, in this order. Columns are found by header aliases, not position.

| # | Field | Label | Required | Header aliases (compared after `normalizeHeader` = lower-case, keep only `[a-z0-9]`) |
|---|---|---|---|---|
| 1 | empId | Emp ID | yes | empid, employeeid, userid, id, empcode, employeecode, empno, employeeno, staffid, uid |
| 2 | name | Name | yes | name, employeename, empname, fullname, username, staffname |
| 3 | reportingOrg | Reporting Orgn | no | reportingorgn, reportingorg, reportingorganization, reportingorganisation, reportingorgname, organization, organisation, org, businessunit, bu |
| 4 | band | Band | no | band, grade, payband, bandgrade |
| 5 | hyperscaler | HyperScaler | yes | hyperscaler, hyperscalers, cloud, cloudprovider, provider, platform |
| 6 | eta | ETA (Date) | no | etadate, eta, date, targetdate, completiondate, expecteddate, completedon, etacompletiondate |
| 7 | status | Certificate done/WIP | yes | certificatedonewip, certificationdonewip, donewip, status, certificatestatus, certificationstatus, certstatus |
| 8 | level | Certification Levels | yes | certificationlevels, certificationlevel, level, levels, certlevel, lvl |
| 9 | email | Email ID | no | emailid, email, emailaddress, mail, mailid, officialemail |

`autoMapColumns(headers)`:
- Fields are processed in this order. For each field, its aliases are tried in order, and the first header index that matches and isn't already used is taken.
- Each header is used at most once. A field with no match gets `null`.
- `missingRequired(mapping)` returns the required fields that are null.

### 7.1 Reading (`lib/parse.ts`)

- `ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xls', '.xlsb', '.ods', '.csv', '.tsv', '.txt']`.
- `readWorkbook(ArrayBuffer)`:
  - Calls `XLSX.read(data, { type: 'array', raw: true, cellDates: false, dense: true })`. `raw: true` keeps CSV text as-is, so "01-10-2026" isn't guessed as a US date.
  - `date1904` comes from `wb.Workbook?.WBProps?.date1904`.
  - Each sheet is read twice:
    - a raw grid: `sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true })`;
    - a display grid: the same call with `raw: false`, i.e. what Excel shows, e.g. "40%".
  - The **header row** is the first row with ≥ 3 non-blank cells. Title rows above it are skipped. Sheets without such a row are dropped.
  - Data rows are all later rows that are not entirely blank. For each, keep its `rows` (raw), its `display` (strings) and `rowNumbers` (1-based spreadsheet row number = index+1), plus `headerRowNumber`.
- `defaultSheetIndex(wb)` returns the first sheet with ≥ 1 data row, else 0.
- `toIsoDate(value, date1904 = false)` returns ISO `yyyy-mm-dd` or `null`:
  1. A `Date` object becomes its local Y/M/D.
  2. A finite number in 1…2958465 is an Excel serial, converted with `XLSX.SSF.parse_date_code(value, { date1904 })`.
  3. Otherwise it's a string. Trim it, then strip a leading weekday with `/^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i`. Then try:
     - ISO `^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$`.
     - Numeric `^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$`. This is **day-first**, unless the 2nd part is > 12 and the 1st is ≤ 12, in which case it's month-first.
     - `^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})[\s\-/.,]+(\d{2}|\d{4})$` (e.g. "1 Oct 2026").
     - `^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?[\s,\-/.]+(\d{2}|\d{4})$` (e.g. "November 18, 2026").
     - Month names: `jan feb mar apr may jun jul aug sep sept oct nov dec`, matched by the first 4, then the first 3 letters, lower-case.
     - A 5-digit numeric string (optionally with decimals) is treated as an Excel serial.
  - Two-digit years get +2000. Impossible dates such as Feb 30 return `null`; validate by round-tripping through `Date.UTC`.

### 7.2 Built-in rules (`lib/rules.ts`)

- `valueKey(v)` = `String(v ?? '')`, whitespace collapsed to single spaces, trimmed, lower-cased. This is the key used to remember decisions.
- `ruleStatus(text)` returns a status, or `null` when the uploader must decide:
  - empty after trimming → `'ns'`;
  - matches `/^\d+(\.\d+)?\s*%$/` → `'wip'`;
  - otherwise let `k` = lower-case letters only:
    - `completed`, `done`, `yes` → `'done'`;
    - `wip`, `inprogress` → `'wip'`;
    - `notstarted` → `'ns'`;
    - anything else → `null`.
  - Consequently "Certified", "Complete", "No", "Pending" and "0.4" all return `null`.
- `ruleLevel(text)` matches `/^(?:l|level)[\s\-_.]*([1-9]\d?)$/` on the trimmed, lower-cased text and returns the number, else `null`.
  - "L1", "l2", "Level 1", "Level-2", "Level_3", "level 4", "LEVEL4", "L5" and "Level 10" are accepted.
  - "Foundation", "1", "Advanced", "II", "L0" and "Lvl 2" return `null`.

### 7.3 HyperScalers (`lib/hyperscalers.ts`)

- `BASE_HYPERSCALERS = ['Anthropic', 'Azure', 'AWS', 'Google']`. These always get a card and a tab, even with no data.
- `KNOWN_HYPERSCALERS` = the base 4 plus `'GitHub', 'Red Hat OpenShift', 'Red Hat Ansible Automation'` (7 total). The 3 extra ones are shown only when the month has rows for them.
- `hsKey(v)` = lower-case, keep `[a-z0-9]` only, then strip a trailing `fde` with `.replace(/(.)fde$/, '$1')`. So "Anthropic FDE" equals "Anthropic", and "FDE" alone stays "fde".
- Aliases (on the hsKey):

| hsKey | Canonical name |
|---|---|
| anthropic, claude, anthropicclaude | Anthropic |
| azure, msazure, microsoftazure, microsoft | Azure |
| aws | AWS |
| google, gcp, googlecloud | Google |
| github, githubcopilot | GitHub |
| openshift, redhatopenshift | Red Hat OpenShift |
| ansible, redhatansible, redhatansibleautomation | Red Hat Ansible Automation |

- Unknown names, e.g. "Oracle Cloud" or a plain "Red Hat", are **added automatically** under their original text and flagged.
- `knownHyperscaler(v)` returns the alias or `null`. `isKnownHyperscaler(name)` and `isBaseHyperscaler(name)` are the two membership checks.
- `sortHyperscalers(names)` de-duplicates, puts known names first in their fixed order (index in KNOWN, unknown = 99), then sorts the rest alphabetically with `localeCompare`.
- `shownHyperscalers(withData)` = `sortHyperscalers([...BASE, ...withData])`.
- `hsMonogram(name)`:
  - fixed values: Anthropic `A\`, AWS `AWS`, Azure `Az`, Google `G`, GitHub `GH`;
  - otherwise the initials of the words when there are several words, else the first 2 letters;
  - capped at 3 characters and upper-cased.

### 7.4 Level configuration (`lib/levelConfig.ts`)

```ts
export interface LevelConfig { default: number; byHyperscaler: Record<string, number>; }
export const DEFAULT_LEVELS = 4;
export const LEVELS_BY_HYPERSCALER: Record<string, number> = {};   // e.g. { Azure: 3 }
export const LEVEL_CONFIG: LevelConfig = { default: DEFAULT_LEVELS, byHyperscaler: LEVELS_BY_HYPERSCALER };
export const levelsFor = (hyperscaler: string, cfg: LevelConfig = LEVEL_CONFIG): number => cfg.byHyperscaler[hyperscaler] ?? cfg.default;
```

- Levels are fixed, never derived from the data. This file is the only place to change them.
- A row above its HyperScaler's count (e.g. L5 when it has 4) is kept in the snapshot, but it is not counted, and it is flagged.
- The snapshots don't store the config, so a change also applies to past months.

### 7.5 Remembered choices (`lib/mappings.ts`)

```ts
export interface Mappings {
  status: Record<string, St | 'skip'>;        // key = valueKey(cell)
  level: Record<string, number | 'skip'>;     // key = valueKey(cell)
  hyperscaler: Record<string, string>;        // key = hsKey(cell) → canonical name (existing one, or itself if kept as new)
}
```

- `emptyMappings()` returns `{ status: {}, level: {}, hyperscaler: {} }`.
- `sanitizeMappings(raw)` keeps only valid entries:
  - status values `done`, `wip`, `ns` or `skip`;
  - level values `'skip'` or an integer 1…99;
  - hyperscaler values that are non-empty strings, trimmed.
- `fetchMappings()`:
  - calls `GET /api/mappings`; `204` gives empty mappings;
  - on any other non-OK response, throws "Could not load saved choices ({status})".
- `saveMappings(m)` calls `PUT` with pretty JSON. A non-OK response throws "Could not save your choices ({status})".

### 7.6 Validation (`lib/validate.ts`)

`cellText(v)`: null or undefined → `''`; a number → `String(v)`; anything else → whitespace collapsed and trimmed.

`validateRows(sheet, mapping, mappings, date1904 = false, today = todayIso(), savedHsKeys = new Set(Object.keys(mappings.hyperscaler)))` returns:

```ts
{ rows: CleanRow[]; issues: RowIssue[]; latestDoneDate: string | null;
  unknownStatus: UnknownValue[]; unknownLevel: UnknownValue[]; newHyperscalers: NewHyperscaler[]; skippedByChoice: number }
// UnknownValue = { key, raw, count, rows: number[] }; NewHyperscaler = UnknownValue & { name }
```

The three lists are sorted by count, descending. For each data row, with `row` = its spreadsheet row number, the steps run in this order:

1. If `empId` is empty: **error** "Missing Emp ID (row skipped)" with value = name (if any). Stop processing the row.
2. If `name` is empty: **warning** "Missing Name".
3. HyperScaler:
   - If it's empty: **error** "Missing HyperScaler (row skipped)". Stop.
   - Otherwise let `hk = hsKey(raw)` and `builtIn = knownHyperscaler(raw)`.
   - If there's no `builtIn` and `savedHsKeys` doesn't contain `hk`, record it in `newHyperscalers` with `{ key: hk, raw, name: raw }`. This means it stays listed even after the uploader picks something on this screen, so the choice can be changed.
   - The canonical name is `mappings.hyperscaler[hk] ?? builtIn ?? newHs.get(hk).name`.
4. Status:
   - If the raw cell is a **number**, use the *display* text, so 0.6 formatted as a percentage reads "60%". Otherwise use `cellText`.
   - `status = ruleStatus(text) ?? mappings.status[valueKey(text)] ?? null`.
5. Level:
   - If the text is empty, the level is `0`.
   - Otherwise `level = ruleLevel(text) ?? mappings.level[valueKey(text)] ?? null`.
6. If status or level is `null`, record it in `unknownStatus` / `unknownLevel` (key, raw, count, rows). The row is **pending**: it is not added, and no further issues are recorded for it.
7. If status or level is `'skip'`: increment `skippedByChoice`, add **warning** "Skipped (your choice for this value)" with the value, and stop.
8. If level is 0: **warning** "Certification Level is empty: counted as an enrollment but not in any level". Otherwise, if `level > levelsFor(hs)`: **warning** `` `L${level} is above ${hs}'s ${n} levels: it won't be counted` `` with the level text as the value. Both rows are kept.
9. ETA: if the cell isn't empty, run `toIsoDate(raw, date1904)`. If that gives `null`: **warning** "ETA date not readable (left empty)" with the text, and leave the ETA as `''`.
10. If the status is `done` and `eta > today`: **warning** "Completed, but the ETA date is in the future" with the ISO ETA.
11. If the email is non-empty and fails `z.string().email()`: **warning** "Email looks invalid (kept as is)". The email is kept.
12. Push the CleanRow, with `reportingOrg` and `band` from `cellText`.

`latestDoneDate` is the maximum ETA among `done` rows that have an ETA ≤ today, or `null`.

### 7.7 Snapshot CSV (`lib/csv.ts`)

- The columns and headers are exactly the 9 sheet labels, in order: `Emp ID, Name, Reporting Orgn, Band, HyperScaler, ETA (Date), Certificate done/WIP, Certification Levels, Email ID`.
- `snapshotToCsv(rows)` uses `Papa.unparse`. Level becomes `L{n}`, or `''` for 0. Status becomes its label (Completed / In progress / Not started). ETA is ISO.
- `csvToSnapshot(text)`:
  - Empty text gives `[]`.
  - It parses with a header, skipping empty lines.
  - If the header row lacks `Reporting Orgn` or `Certification Levels`, or contains `Added In`, it throws `OldFormatError`, with the message "This snapshot uses an earlier column format. Move it to local-data/archive-old-format/ and upload the monthly sheet again."
  - It trims each value. Status labels map back (unknown → `ns`). The level goes through `ruleLevel` (fallback 0).
  - The round-trip must be lossless.
- `issuesToCsv(issues)` has the headers `Row, Emp ID, Severity, Issue, Value`.
- `toCsv(fields, data)` calls `Papa.unparse({ fields, data })`.
- `downloadText(fileName, text, type = 'text/csv')`:
  - creates a Blob with `type;charset=utf-8`;
  - clicks a temporary `<a download>`;
  - revokes the URL after 1 s.

### 7.8 Snapshot names (`lib/snapshotName.ts`)

- `ddmmyy(d)` and `hhmmss(d)` are zero-padded, local time.
- `isoToDate(iso)` gives local midnight.
- `buildSnapshotId(latestSheetDate, now)` = `${latestSheetDate ? ddmmyy(isoToDate(latest)) : ddmmyy(now)}-${ddmmyy(now)}-${hhmmss(now)}`.
  - `('2026-11-15', 18 Nov 2026 09:30:05)` gives `151126-181126-093005`.
  - With `null`, it gives `181126-181126-093005`.
- `ID_RE = /^(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/`. `isSnapshotId(id)` tests the id against it.
- `parseSnapshotId(id)` returns `{ dataUpTo, uploadedAt }` with year = 2000+yy, or `null`.
- `uploadOrderKey(id)` = yymmdd of the upload date plus hhmmss. Order is by upload time, not by data date.

### 7.9 Saving an upload (`lib/runImport.ts`)

`runImport(rows, latestDoneDate)`:
- Serializes the rows to CSV once.
- Tries up to 10 ids, built from `new Date(start + attempt * 1000)`, POSTing each.
- On `409`, it tries the next second.
- It returns the saved id, or throws "Could not find a free snapshot file name. Please try again."

### 7.10 API client (`lib/api.ts`)

- `listSnapshots()`:
  - calls `GET /api/snapshots`; a non-OK response throws "Could not list snapshots ({status})";
  - maps each entry to `{ id: name without .csv, ...parseSnapshotId(id), sizeBytes }` and drops unparsable ones.
- `fetchSnapshot(id)` takes `'latest'` or an id and returns `{ id: string | null, rows: DataRow[] }`:
  - `204` gives `{ id: null, rows: [] }`;
  - `404` throws "Snapshot {id} not found"; other failures throw "Could not load data ({status})";
  - the id comes from the `X-Snapshot-Name` header, with `.csv` stripped.
- `fetchSnapshotText(id)` returns the raw CSV. On failure it throws "Could not load {id}".
- `saveSnapshot(id, content)` POSTs `{ name: id + '.csv', content }`:
  - `201` gives `'saved'` and `409` gives `'exists'`;
  - anything else throws the server's `error`, or "Save failed ({status})".

---

## 8. Aggregation (`lib/aggregate.ts`)

```ts
export interface Counts { done: number; wip: number; ns: number }
export interface Enrollment {
  key: string;              // `${empKey}|${hyperscaler}`
  empId; name; email; reportingOrg; band; hyperscaler: string;
  levels: St[];             // index 0 = L1; length = levelsFor(hyperscaler)
  etas: string[];           // per level, '' if none
  status: St;
  highest: number;          // highest completed level, 0 = none
  latestEta: string;        // max ETA across all its rows (including empty-level / over rows)
  dupLevels: number[];      // levels that had > 1 row
  dupRows: number;          // extra rows beyond the first per level
  skipped: boolean;         // a level completed while a lower one isn't
  emptyLevelRows: number;
  overRows: number;         // rows above its HyperScaler's level count
}
export interface Summary { total: number; employees: number; s: Counts; started: number; levels: Counts[];
  highest: { none: number; byLevel: number[] }; reached: number }
export interface GroupRow { name: string; total: number; employees: number; s: Counts }
export interface ProfileConflict { empId: string; field: 'Name' | 'Reporting Orgn' | 'Band' | 'Email ID'; values: string[] }
export interface Quality { duplicateRows; duplicateEnrollments; skipped; increasing: number[]; emptyLevelRows;
  overRows; overEnrollments; profileConflicts: ProfileConflict[]; noOrg; noBand; noEmail; addedHyperscalers: string[] }
export interface Dataset { N: number; rowCount: number; enrollments: Enrollment[]; hyperscalers: string[]; summary: Summary; quality: Quality }
```

`buildDataset(rows, levelCfg = LEVEL_CONFIG)`:

1. **Profiles per employee** (keyed by empKey):
   - For name, reportingOrg, band and email, take the **first non-empty** value.
   - Keep the set of distinct non-empty values per field. Email is compared lower-cased.
   - A field with more than 1 distinct value is a `ProfileConflict`, with values in first-seen order. Field labels are `Name`, `Reporting Orgn`, `Band`, `Email ID`.
2. **Enrollments**, keyed `${empKey}|${hyperscaler}`:
   - On creation: `n = levelsFor(hs)`, `levels = n × 'ns'`, `etas = n × ''`, and a per-level row counter.
   - For each row:
     - if `r.eta > latestEta`, update `latestEta`;
     - if level is 0: `emptyLevelRows++`, then continue;
     - if `level > n`: `overRows++`, then continue;
     - otherwise increment that level's counter. If the counter is now > 1: `dupRows++`, and add the level to `dupLevels` if it isn't there yet.
   - **The furthest status wins** (rank ns 0 < wip 1 < done 2). Replace the level's status and ETA when:
     - this is the first row for that level; or
     - the new rank is higher; or
     - the rank is equal, the stored ETA is empty and the new one isn't.
3. Per enrollment:
   - `highest = lastIndexOf('done') + 1`.
   - `skipped = lastDone > 0 && some level before lastDone isn't 'done'`.
   - **status** is `'done'` when the HyperScaler's **top level** (the last element) is done; else `'wip'` when any level isn't `ns`; else `'ns'`.
4. `N` = the maximum `levels.length` over the enrollments, or 0 if there are none.
5. `summary = summarize(enrollments, N)`.
6. `hyperscalers = sortHyperscalers(enrollment hyperscalers)`.
7. `quality = { ...subsetQuality(enrollments, summary, conflicts), addedHyperscalers: hyperscalers not in the known 7 }`.

`summarize(list, N)`:
- `s` counts enrollment statuses; `employees` = distinct empKeys; `started = done + wip`.
- `levels[i][status]++` for every level an enrollment has. A level counts only the enrollments whose HyperScaler has that level.
- `highest.byLevel[highest-1]++`, or `none++` when there's no completed level.
- `reached = total − none`.

`subsetQuality(list, sum, allConflicts)`:
- Sums `dupRows`, `emptyLevelRows` and `overRows`. Counts the enrollments with `dupRows > 0`, with `skipped`, and with `overRows > 0`.
- `increasing = increasingLevels(sum)`.
- `profileConflicts` = the conflicts whose employee is in the list.
- `noOrg`, `noBand` and `noEmail` count distinct employees, using the first enrollment seen per employee.
- `addedHyperscalers: []` (only the whole-file dataset fills it).

`increasingLevels(sum)` returns the 1-based levels `i+1` where `levels[i].done > levels[i-1].done`.

`groupBy(list, field)`, with `field ∈ 'hyperscaler' | 'reportingOrg' | 'band'`, returns rows `{ name, total, employees, s }`. The sort is:
- `''` ("Not given") is always last;
- then total, descending;
- then name ascending.

`PeopleFilter = { hs?, org?, band?, st?: St, lv?: number, ls?: St, hi?: number, flag?: 'skip' | 'dup' | 'nolevel' | 'over', q?: string }`. Here `org: ''` means "not given".

`applyFilter(list, f)` applies every condition that is defined:
- `hs`, `org` and `band` require equality.
- `st` requires that enrollment status.
- `lv` + `ls` (both required) means `levels[lv-1] === ls`.
- `hi` requires `highest === hi`.
- `flag`: `skip` → skipped, `dup` → `dupLevels.length > 0`, `over` → `overRows > 0`, `nolevel` → `emptyLevelRows > 0`.
- `q` is trimmed, lower-cased and matched as a substring of `"${empId} ${name} ${email} ${reportingOrg} ${band} ${hyperscaler}"` (lower-cased).

`pct(v, t, d = 1)` = `t ? (v/t*100).toFixed(d) : (0).toFixed(d)`, a string.

`empKey(id) = id.trim().toUpperCase()`.

---

## 9. Helpers

**`lib/format.ts`**
- `fmtDate(d)` uses `en-GB` `{ day: '2-digit', month: 'short', year: 'numeric' }` → "18 Nov 2026".
- `fmtDateTime(d)` = `${fmtDate(d)}, ${HH:MM en-GB}` → "18 Nov 2026, 10:42".
- `fmtIso(iso)` = `fmtDate(isoToDate(iso))`, or "—" when empty.
- `fmtNum(n)` = `n.toLocaleString('en-IN')`, i.e. Indian grouping (1,00,000).
- `fmtShort(iso)` gives "30 Dec", adding a 2-digit year when the year isn't the current one, or "—".
- `todayIso(now = new Date())` = the local `yyyy-mm-dd`.
- `snapshotLabel(id)` = fmtDateTime of the upload time.
- `snapshotUploadDate(id)` = fmtDate of the upload time.
- `dataMonth(id)` = the upload month as `en-GB { month: 'short', year: 'numeric' }`, e.g. "Nov 2026", or "—". **The data month is always the upload month.**
- `monthOf(d)` uses the same month format.

**`lib/links.ts`**
- `peopleUrl(f)` builds `/people?` with params in this order: `hs`, `org`, `band`, `st`, `lv` & `ls` (only together), `hi`, `flag`.
  - `hs`, `org`, `band` and `hi` are included when `!== undefined`, so an empty org is allowed.
  - With no params it returns `/people`.
- `hsUrl(name)` = `/hs/${encodeURIComponent(name)}`.

**`lib/brand.ts`**

```ts
export const BRAND = {
  name: 'Your Company',               // placeholder; used in copyright and logo alt
  logo: 'assets/brand/logo.svg',      // wide wordmark (name inside the logo), served from src/assets
  copyright: '© {year} {name}. All rights reserved.',
  product: 'AI Academy FDE Dashboard',
} as const;
export function copyrightText(now = new Date()) { /* replace {year} with full year and {name} with BRAND.name */ }
/** App version shown in the footer (keep in step with package.json). */
export const APP_VERSION = '0.1.0';
```

**`lib/levels.ts`** generates the indigo level ramp for any N, in OKLCH. Hue 277; lightness goes from 0.74 (L1) to 0.24 (top). Each colour gets white or `#1E1B4B` ink, whichever contrasts more. Copy Appendix D verbatim. `levelRamp(n)` returns `{ level, hex, ink }[]`, cached per n.

**`lib/logos.ts`** holds the brand icons from Simple Icons v13 (CC0) for Anthropic, AWS, Google, GitHub, Red Hat OpenShift and Red Hat Ansible Automation. Azure is a lettered tile "Az" in `#0078D4`. Copy Appendix B verbatim.

**`src/app/core/data.service.ts`**: `@Injectable({ providedIn: 'root' }) class DataService`. This is the app-wide data store, built on signals.
- `param = signal<string | null>`: the selected snapshot id from `?snapshot=`, or `null` for latest.
  - It is read in the constructor, and again on every `NavigationEnd`, from `router.parseUrl(router.url).queryParamMap`.
  - The value is accepted only if `isSnapshotId`; otherwise it is `null`.
- `snapshots = signal<SnapshotInfo[]>`, filled by `refreshList()` (which calls `listSnapshots()`). It is called once in the constructor.
- A private `loaded` signal holds `LoadedSnapshot | null`, alongside `loading = signal(true)`, `error = signal<string | null>` and a private `Map` cache of loaded snapshots keyed by `'latest'` or an id.
- Computed signals:
  - `rows` = `loaded()?.rows ?? []`;
  - `dataset` = `buildDataset(rows())`;
  - `snapshotId` = `loaded()?.id ?? null`;
  - `latestId` = `snapshots()[0]?.id ?? null`;
  - `isPast` = `param !== null && latestId !== null && param !== latestId`.
- An `effect(() => load(param() ?? 'latest'), { allowSignalWrites: true })` loads the selected month.
- `load(id)`:
  - On a cache hit, it sets `loaded` immediately and sets `loading` to false.
  - Otherwise it sets `loading` true, clears `error`, calls `fetchSnapshot`, and caches the result. It sets `loaded` only if `param() ?? 'latest'` still equals the id it was loading. Errors go to `error` as a message string. `loading` is set to false at the end.
- `snapshot(id)` returns any one snapshot, cached; the import summary uses it.
- `afterUpload()` deletes the `'latest'` cache entry, awaits `refreshList()`, and reloads latest when no past month is selected.
- `setSnapshot(id | null)` calls `router.navigate([], { queryParams: { snapshot: id }, queryParamsHandling: 'merge' })`. A `null` id removes the param.
- Exported helper `withSnapshot(url, snap)` appends `snapshot=<encoded id>` with `?` or `&` when `snap` is set.

**`src/app/core/snap-link.directive.ts`**: `@Directive({ selector: 'a[snapLink]', standalone: true })`, with a required `@Input() snapLink: string`.
- It binds `attr.href` to `withSnapshot(snapLink, data.param())`, so a past view stays past while navigating.
- On a plain left click it calls `preventDefault()` and `router.navigateByUrl(href)`.
- Ctrl/Cmd/Shift/Alt-click and middle-click keep the browser default (a new tab or window).
- **Every internal link in the dashboard is an `<a [snapLink]="…">`**. The exceptions are the header nav (`routerLink` with `[queryParams]`), the Uploads page, and the "Upload" button.

**`src/app/core/fill.ts`**:
- `startFill(destroyRef, delay, dur = 1300): Signal<number>` returns a signal going 0→1, eased with cubic ease-out via `requestAnimationFrame`, once. The animation frame is cancelled on destroy.
- It returns 1 straight away under `prefers-reduced-motion`, or when `requestAnimationFrame` doesn't exist.
- `prefersReducedMotion()` is exported too.
- Components create their fill in `ngOnInit` (`this.e = startFill(this.destroyRef, …)`), with `e` initialised to `signal(reduced ? 1 : 0)`. Inputs such as `i` are therefore available when the fill starts.

---

## 10. Visual design system

The full stylesheet is Appendix A. Copy it verbatim as `apps/web-ng/src/styles.css`, a global stylesheet listed in `angular.json`; components have no styles of their own. It starts with the Tailwind v3 directives `@tailwind base; @tailwind components; @tailwind utilities;`. The Tailwind colour and font names come from `tailwind.config.js` (§4). The stylesheet defines the tokens:

- Page `--bg #f4f6fb`, cards `#fff`, lines `#e3e8f2`, ink `#0f1b3d`, ink-2 `#44506b`, muted `#6b7690`, brand `#1d4ed8` (hover `#1e40af`), wash `#eef2ff`.
- Status `--done #16a34a`, `--wip #2563eb`, `--ns #94a3b8`, and `--none #e2e8f0` for "no level yet".
- Amber, red and green backgrounds for warnings.
- Golden-ratio spacing `--s1..--s5` = 8, 13, 21, 34, 55 px. The type scale is 13 · 16 · 20 · 26 · 33 · 42 · 53 · 68 · 86 px.
- Body: 14 px Manrope, line-height 1.45, tabular numbers.
- Big numbers (`.bignum`) are weight 600 with tracking −.03em. Digits are equal-width only while counting up (`.counting`).
- Liquid tints:
  - done `#d5f3df`, wip `#d9e6fd`, ns `#e5e9f0`;
  - indigo `ind` `#e3e2fd`, amber `amb` `#fde7c2`.
- Layout:
  - `.page` = padding 18px 40px 48px, max-width 1480, centred;
  - `.stack` is a grid with an 18px gap;
  - `.g4` and `.hsq` are 4-column grids, dropping to 2 columns below 1100 px;
  - `.grid2` has 2 columns, dropping to 1 below 1100 px.
- Section labels `.sec` are 13 px, uppercase, tracked .12em, muted.
- Focus ring: `2px solid #6366f1`, offset 2.

### Motion rules
- `startFill(destroyRef, delay, dur = 1300)` (`core/fill.ts`) returns a signal going 0→1, eased with cubic ease-out (`1-(1-t)^3`) via `requestAnimationFrame`, **once per mount**. Under `prefers-reduced-motion` it returns 1 immediately.
- Liquid cards add the class `moving` while filling (`0 < e < 1`) or while hovered/focused. The CSS wave animation is `paused` by default and `running` only with `.moving`, so it freezes in place without a jump.
- Funnel glasses wave while pouring or on hover/focus. Pour bars show a rippling front edge while pouring.
- After about 2 s, nothing on the page moves.

---

## 11. Components

**Angular conventions used by every component below**
- Every component is `standalone: true`, imports exactly the components and directives it uses, and has an inline `template` and no `styles`.
- Small presentational components set `host: { style: 'display:contents' }`, so the host element doesn't break the CSS grid and flex layouts: `app-icon`, `app-hs-logo`, `app-lvl-chip`, `app-new-tag`, `app-status-bar`, `app-num`, `app-lab`, `app-compare`, `app-liquid-card`, `app-insight-cards`, `app-pour-bar`, `app-card-head`, `app-number-tile` and `app-levels-body`. `app-stepper` instead has the host style `margin-left:auto`.
- Inputs are `@Input()` fields; required ones use `@Input({ required: true })`. Function inputs, such as `to: (st) => string`, are passed as arrow-function class fields.
- Values derived from inputs are computed in `ngOnChanges` (for example HsCards rows, Fluid card segments and the PeopleTable sort) or in getters. Page state uses `signal` and `computed`.
- Wherever the text below says **"SnapLink to X"**, use `<a [snapLink]="X">`, or `<a snapLink="/">` for a static path. The class, title and aria attributes go on that `<a>`.
- Where a React-style "children(e)" render function is described for liquid cards, Angular uses **content projection plus a template reference**: `<app-liquid-card #c [i]="1" …><app-num [value]="v" [e]="c.e()" /></app-liquid-card>`. The card exposes its public `e` signal.
- Inside a card, the body markup is written once in an `<ng-template #body>` and rendered with `*ngTemplateOutlet` (`NgTemplateOutlet`) inside an `<a [snapLink]>`, a `<button type="button">`, or a `<div>`. The same pattern is used in PourBar, for segment content, and in FunnelGlasses, for the glass.

| Spec name below | Angular class / selector | File |
|---|---|---|
| Header | `HeaderComponent` / `app-header` | ui/shell.ts |
| SnapshotPicker | `SnapshotPickerComponent` / `app-snapshot-picker` | ui/shell.ts |
| Footer | `FooterComponent` / `app-footer` | ui/shell.ts |
| PeopleTable, exportPeopleCsv | `PeopleTableComponent` / `app-people-table` | ui/shell.ts |
| PastViewBanner | `PastBannerComponent` / `app-past-banner` | ui/basics.ts |
| Icons | `IconComponent` / `app-icon` | ui/basics.ts |
| HsLogo | `HsLogoComponent` / `app-hs-logo` | ui/basics.ts |
| LvlChip | `LvlChipComponent` / `app-lvl-chip` | ui/basics.ts |
| NewTag | `NewTagComponent` / `app-new-tag` | ui/basics.ts |
| StatusBar | `StatusBarComponent` / `app-status-bar` | ui/basics.ts |
| Breadcrumb (`Crumb = { label, to? }`) | `BreadcrumbComponent` / `app-breadcrumb` | ui/basics.ts |
| Stepper | `StepperComponent` / `app-stepper` | ui/basics.ts |
| HsTabs | `HsTabsComponent` / `app-hs-tabs` | ui/basics.ts |
| DataQuality | `DataQualityComponent` / `app-data-quality`, plus the exported `qualityItems(q, sum, base): Part[][]` with `Part = { t: string; b?: boolean; to?: string }` (plain text, bold, or link), rendered by the template | ui/basics.ts |
| Num, Lab, Compare | `NumComponent` / `app-num`, `LabComponent` / `app-lab` (`<ng-content/>` with an optional dot), `CompareComponent` / `app-compare` | ui/liquid.ts |
| LiquidCard | `LiquidCardComponent` / `app-liquid-card` | ui/liquid.ts |
| StatusCards, InsightCards, HsCards, `countChecks`, `WAVE` | `StatusCardsComponent` / `app-status-cards`, `InsightCardsComponent` / `app-insight-cards`, `HsCardsComponent` / `app-hs-cards` | ui/liquid.ts |
| PourBar, CardHead | `PourBarComponent` / `app-pour-bar`, `CardHeadComponent` / `app-card-head` (title, tip, `<ng-content/>` for the right-hand controls) | ui/fluid.ts |
| LevelStatusCard, FunnelGlasses, HighestCard, BreakdownCard | `LevelStatusCardComponent` / `app-level-status-card`, `FunnelGlassesComponent` / `app-funnel-glasses`, `HighestCardComponent` / `app-highest-card`, `BreakdownCardComponent` / `app-breakdown-card` | ui/fluid.ts |
| StatRow, NumberTile | `StatRowComponent` / `app-stat-row`, `NumberTileComponent` / `app-number-tile` | ui/fluid.ts |

Angular-specific details of these components:
- **LiquidCard** inputs: `i`, `level?`, `tone?`, `link?` (renders an `<a [snapLink]>`), `clickable` (renders a `<button>` and emits `@Output() act`), `warn`, `bad`, `compact`, `state?`, `corner?: string`, and `tubes?: Counts`.
  - Instead of an `extra` render prop, passing `tubes` draws the three mini tubes of the Total-enrolled card.
  - Hover and focus set a private `hovered` signal; it stays false under reduced motion.
  - `cls` joins the classes, dropping empty ones.
- **Fluid cards**: an abstract `@Directive() class Fills implements OnInit` holds `fillDelay` (150), `fillDur` (1500) and the `e` signal.
  - LevelStatusCard uses 150/1500, FunnelGlasses overrides to 250/1600, HighestCard to 350/1500, and BreakdownCard to 200/1300.
- **PourBar** `Seg` has `label?: string` and `sub?: string`. When `sub` is set, the segment content is `<span class="two"><b>{label}</b><small>{sub}</small></span>`; the HighestCard segments use this. The label shows only when `!!label && total > 0 && v/total ≥ minShare`.
- **Status-per-level legend** is static HTML: `<div class="fl-legend">` with three `<span><i class="dot done|wip|ns"></i>Label</span>`.
- **FunnelGlasses** computes `steps: { key, label, lv?, v, color, to?, share, conv, pill, kind: ''|'worst'|'over' }[]` in `ngOnChanges`. The glass label is `<app-lvl-chip> ✓` for level steps and the text label otherwise.
- **BreakdownCard** holds `by`, `sort` and `all` as fields and recomputes `shown` rows `{ r, name, to, width, segs, started }` on every change. The sort `<select>` uses `[value]` and `(change)`.
- **PeopleTable** projects the toolbar through `<ng-content select="[toolbar]" />`; the page puts the `toolbar` attribute on the toolbar div.
  - Sorting and paging state are plain fields: `sorted`, `rows`, `pages`, `p`.
  - `ngOnChanges` resets the page to 0 and re-sorts whenever the list changes.
  - The columns come from a `cols` array. Email ID is not sortable, and the HyperScaler column is skipped when `hideHs` is set.
- **DataQuality**'s `base` input defaults to `{}`.
- **StatusBar** binds `[style.flex]` to the count. The `<a>`/`<i>` segment gets `[class]` = the status key.

### 11.1 `HeaderComponent` (`app-header`, ui/shell.ts; design "W2": one light, sticky bar)

`<header class="app-hdr">` contains, left to right:

1. `SnapLink to="/" class="app-brand"` (aria-label `"{BRAND.name}: {BRAND.product} home"`) wrapping `<img class="app-logo" src={BRAND.logo} alt="{BRAND.name} logo">`. The logo is 40 px tall, max 360 px wide.
2. `<span class="app-sep">`, a 1 px vertical divider.
3. `SnapLink to="/" class="app-title"` showing the product name. Its `margin-right: auto` pushes the rest right.
4. `<nav class="hnav" aria-label="Main">`, a segmented pill with three `routerLink` anchors. Each has `[queryParams]="qp()"`, where `qp = computed(() => param ? { snapshot: param } : {})`, so a past month is kept:
   - "Dashboard" (`['/']`): the class `active` is set by the getter `isDash`, which is true when the path before `?` is `/` or starts with `/hs/`;
   - "Employees" (`['/people']`, `routerLinkActive="active"`);
   - "Uploads" (`['/uploads']`, `routerLinkActive="active"`).
   - The active item has a white background, brand colour and a shadow.
5. `<app-snapshot-picker />`.
6. `<button class="btn-up">` with `<app-icon name="upload" />` and "Upload". It calls `router.navigateByUrl('/upload')`.
   - When viewing a past month it is **disabled**, with title "Switch to the latest data to upload".
   - Otherwise its title is "Upload the monthly Excel / CSV".

### 11.2 `SnapshotPickerComponent` (`app-snapshot-picker`, ui/shell.ts; the "Month" control)

- It renders nothing when there are no snapshots.
- The button is `.chip` (amber `.past` variant when isPast), with `aria-haspopup="listbox"` and `aria-expanded`. It shows:
  - the History icon;
  - a muted "Month";
  - bold `dataMonth(snapshotId)`;
  - a `.mon-tag` that reads "Latest" or "Past" (amber when past);
  - "▾".
- The popover is `.popover right-0 mt-2 w-[380px] max-h-[420px] overflow-auto p-1.5`, `role="listbox"`.
  - Its header `.k` reads "Monthly uploads · newest first".
  - Each snapshot is an option button containing:
    - a 2 px dot, brand-coloured when selected;
    - bold "{Mon YYYY} data", plus a `pill i` "Latest" on the first one;
    - a 12 px muted line "Uploaded {fmtDateTime} · latest completion {fmtDate(dataUpTo)}".
  - The selected option gets `bg-wash`.
  - Clicking the first (newest) option clears `?snapshot`; any other sets it. Either way the popover closes.
  - It also closes on an outside mousedown or on Escape.

### 11.3 `PastBannerComponent` (`app-past-banner`, ui/basics.ts)

- Shown only when `isPast`.
- It is a `.banner-past` strip (amber), `role="status"`, with an inner container `max-w-[1480px] mx-auto px-10 py-2.5 flex items-center gap-3 text-[13.5px]`. It contains:
  - "🕓";
  - "You're viewing **{Mon YYYY}** data (uploaded {snapshotLabel}). It's read-only, and uploading is off until you go back to the latest data.";
  - a `btn sm ghost ml-auto` button "Back to latest →", which clears the snapshot param.

### 11.4 `FooterComponent` (`app-footer`, ui/shell.ts; design "F2")

`<footer class="app-ftr">` contains:
- `<img class="ftr-logo">`, decorative;
- the copyright text;
- `.ftr-right`, which holds:
  - when a snapshot is loaded: "📅 {Mon YYYY} data", with " (past month)" appended when past, and "⤒ Uploaded {snapshotLabel}";
  - `.ftr-ver` "v{APP_VERSION}".
- The footer always sits at the bottom of the viewport (`.app-shell` is a flex column with min-height 100vh).

### 11.5 `HsLogoComponent` (`app-hs-logo`, ui/basics.ts)

`<span class="hs-logo [sm]" style="--b: brandColour" aria-hidden>` shows either:
- an `<svg viewBox="0 0 24 24">` with the Simple Icons paths; or
- `<span class="mono">` with the tile text, or `hsMonogram(name)`.

The colour comes from the logo, else the tile, else `#1e3a8a`. The tile background and border are `color-mix` tints of `--b`.

### 11.6 `IconComponent` (`app-icon`, ui/basics.ts)

A single component with a required `name: 'upload' | 'search' | 'history' | 'download' | 'file'` input. It renders the matching inline SVG through `@switch`. Copy Appendix C verbatim; it is part of `ui/basics.ts`.

### 11.7 ui/basics.ts: shared pieces

- `LvlChip({lv, N})` renders `<span class="lvl">L{lv}</span>`, with the background and ink from `levelRamp(max(N, lv))[lv-1]`.
- `NewTag({name})` renders `<span class="tag-new" title="Not one of the 7 known HyperScalers: added automatically from the uploaded file">added from file</span>` for unknown HyperScalers, and null otherwise.
- `orNone(v)` = `v || 'Not given'`.
- `StatusBar({ s, big?, to?, label? })` is a 100 % bar `.sbar` with segments in the order done, wip, ns.
  - Each segment has `flex: count`. Zero-count segments are omitted.
  - With `to`, segments are `SnapLink`s with the title "{Label}: {n} · {pct}% (open list)". Without it, they are `<i>` with "{Label}: {n} · {pct}%".
  - An empty bar is `.sbar empty-bar` with aria-label "No data".
  - The bar has `role="img"` and aria-label "{label}: Completed x, In progress y, Not started z".
- `Breadcrumb({parts})` renders `<nav class="bc" aria-label="Breadcrumb">`. Each earlier part is a SnapLink followed by `<span class="sep">›</span>`; the last part is `<b aria-current="page">`.
- `Stepper({list, current})` renders `.stepper` with:
  - "‹ {prev}" as a link, or `<span class="dis">‹ Prev</span>`;
  - `<b>{i+1} of {n}</b>`;
  - "{next} ›", or a disabled "Next ›".
- `HsTabs({dataset, active})` renders `<nav class="subtabs" aria-label="HyperScaler views">`, a white strip under the header. It holds:
  - an "Overall" tab: `<b>Overall</b> <small>{employees} employees</small>`;
  - one tab per `shownHyperscalers(dataset.hyperscalers)`: a small HsLogo, `<b>{name}</b>` and `<small>{enrollment count or 0}</small>`.
  - The active tab gets `.on`, with a brand underline.
- `DataQuality({ q, sum, base, scope? })`:
  - The bullet list appears only for the items that apply, in this order:
    - when there are added HyperScalers and `!base.hs`: "**{names joined ', '}** is/are not one of the 7 known HyperScalers (Anthropic, Azure, AWS, Google, GitHub, Red Hat OpenShift, Red Hat Ansible Automation) and was added automatically from the file."
    - when there are increasing levels: "Completed counts go up at L2, L3 (L1 ≥ L2 ≥ … expected, since levels are cumulative)."
    - skipped: "[{n} enrollment(s)](people?flag=skip) has/have a level completed while a lower level isn't."
    - duplicates: "**{n} row(s)** repeats/repeat the same employee × HyperScaler × level (in [{m} enrollment(s)](flag=dup)). The furthest status was kept."
    - over-level rows: "**{n} row(s)** is/are above its HyperScaler's levels (e.g. L5 when it has 4) and is/are not counted ([{m} enrollment(s)](flag=over)). Level counts are set in levelConfig.ts."
    - empty levels: "**{n} row(s)** has/have an empty Certification Level ([see enrollments](flag=nolevel)): they count as enrollments but not in any level."
    - profile conflicts: "**{distinct emp count} employee(s)** with different values across their rows (e.g. {first 2 as `"{empId} {field}: v1 / v2"` joined '; '}). The first value is used."
    - "**{n} employee(s)** without a Reporting Orgn (shown as "Not given")."
    - "**{n} employee(s)** without a Band (shown as "Not given")."
    - "**{n} employee(s)** without an Email ID."
  - Numbers use `fmtNum`, and the singular/plural forms follow the count.
  - The links are `SnapLink(peopleUrl({...base, flag}))`, so on a HyperScaler view they keep `hs`.
  - With no items, render `.dq ok`: an `.h2` "✓ Data checks passed{ for {scope}}" and an `.h2-sub` in `#166534`: "Levels are cumulative (L1 ≥ L2 ≥ …), no duplicate rows, no skipped levels, and every employee has an Org, Band and Email ID."
  - Otherwise render `.dq` (amber): an `.h2` "⚠ Data checks{: {scope}}" and a `<ul>` (margin-top 6) of `<li>`.

### 11.8 ui/liquid.ts: liquid cards

- `Num({ value, e, dec = 0, suffix = '', cls = 'n68' })` renders `<span class="bignum {cls} [counting when e<1]">` showing `value*e`. With `dec` it uses `toFixed(dec)`, else `fmtNum(Math.round(v))`, followed by the suffix.
- `WAVE = 'M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V20 H0Z'`.
- `Liquid({level, tone})` renders `<div class="liq {tone}" style="height:{level}%">` with two `<svg class="wave">` / `<svg class="wave w2">` (viewBox 0 0 200 20, `preserveAspectRatio="none"`), each holding the WAVE path.
- `LiquidCard` (inputs `i`, `level?`, `tone?`, `link?`, `clickable` + `(act)`, `warn`, `bad`, `compact`, `state?: 'selected'|'dim'`, `corner?`, `tubes?`; projected content):
  - `e = startFill(destroyRef, i * 110)`, set in `ngOnInit`. It has hover handlers on mouse enter/leave and focus/blur (the `<div>` variant handles mouse only).
  - Class: `lq {state} {tone} [sm] [warn] [bad] [moving]`.
  - Body:
    - the Liquid at height `max(level, 4) * e` %, only when both `level` and `tone` are set;
    - then the `.tubes` (when `tubes` is set);
    - then `<span class="lq-corner">{corner}</span>`;
    - then `<div class="in">{children(e)}</div>`.
  - It renders as an `<a [snapLink]>` when `link` is set, a `<button type="button">` (emitting `act`) when `clickable` is set, else a `<div>`.
- `Lab({children, dot?})` renders `<div class="lq-lab">` with an optional `<i class="dot {st}">`.
- `Compare({ v, pv })` compares percentages: `d = v − pv`.
  - When `|d| < max(0.1, pv × 0.1)` it shows "≈ same as Overall ({pv.toFixed(1)}%)" with class `cmpb eq`.
  - Otherwise it shows "▲ {|d|.toFixed(1)} pts vs Overall" (`up`, green) or "▼ … pts vs Overall" (`down`, red).
- `StatusCards({ sum, base, parent? })` is a `.g4` row of 4 cards:
  0. i=0, links to `peopleUrl(base)`. Its label is "Total enrolled" and it shows `Num(total)` at the n68 size.
     - The sub-line reads:
       - with a parent (a HyperScaler view): "{pct(total, parent.employees, 0)}% of all {parent.employees} employees";
       - otherwise: "{employees} employees".
     - `[tubes]="sum.s"` adds `.tubes`: 3 vertical tubes (done, wip, ns). Each is filled to `max(share %, 4) * e`.
  1. **In progress**, 2. **Completed**, 3. **Not started**, in that order, with `i = 1..3`.
     - Each card has the liquid at that status's share, tone = the status, links to `peopleUrl({...base, st})`, and a label with a status dot.
     - Each shows `Num` and the sub "{pct}% of total". On Completed, " · all {levels.length} levels" is appended when there is more than 1 level.
     - The Completed card shows a `Compare` against `parent.s.done/parent.total` when there's a parent.
- `countChecks(q, withHs)` = the number of truthy values among `[withHs && addedHyperscalers.length, increasing.length, skipped, duplicateRows, emptyLevelRows, overRows, profileConflicts.length, noOrg, noBand, noEmail]`.
- `InsightCards({ sum, q, base, parent? })` is a `.g4` row with local `open` state:
  - i=4 **Started**: tone `ind`, level = started share. It shows `Num(started %, dec 1, suffix '%', n53)`, the sub "{started} of {total}", and a Compare with the parent when there is one.
  - i=5 **Reached L1+**: tone `ind`, level = reached share. It shows the % in the same style, the sub "{reached} completed a level", and a Compare.
  - i=6 is one of three variants:
    - If `increasingLevels(sum)` isn't empty, it's a `bad` (red) card "Levels don't add up". Its bignum (n53, colour `#991b1b`) reads "L{k} > L{k−1} ⚠", with the sub "{levels[k−1].done} vs {levels[k−2].done} completed".
    - Otherwise compute `steps = [started, L1.done, L2.done, …]`. The worst step `w` (index ≥ 1, previous value non-zero) has the lowest `steps[w]/steps[w−1]`. If one exists, it's an amber `warn` card with tone `amb`, level = that ratio %, label "Biggest drop", and an n53 bignum reading "Start → L1" when `w==1`, else "L{w−1} → L{w}". Its sub is "only **{pct(steps[w], steps[w−1], 0)}%** continue".
    - Otherwise a plain card "Biggest drop" with a muted "—" and "no levels in this file".
  - i=7 **Data checks** is a button card that toggles `open`, and is `warn` when there's at least 1 check.
    - It shows `Num(checks, n53)`, or "✓" in `var(--done)`.
    - The bold sub reads "to review ▾/▴" or "all passed ▾/▴".
  - When `open`, `<DataQuality q sum base scope={base.hs}/>` renders below the row.
- `HsCards({ d, monthLabel })` is a `.hsq` grid over `shownHyperscalers(hyperscalers with data)`:
  - With data: `SnapLink class="sq"` to `hsUrl(name)`. It contains:
    - a large HsLogo (76 px tile, 47 px icon);
    - `.nm` name, plus a `.tag-new` "new" (title "Not one of the known HyperScalers: added automatically from the uploaded file") when unknown;
    - `.ct`: an n42 bignum of the enrollment count with `<small>employees</small>`;
    - a StatusBar (8 px);
    - `.dn` "✓ {done} completed", or `.dn z` "none completed yet";
    - `.go` "View details →".
    - Hover lifts the card 2 px with an indigo border.
  - Without data (base ones only): `<div class="sq empty">` with dashed styling and a greyscale logo. It shows the name, a `.tag-nod` "no data", an n42 "0" with "employees", an empty striped `.sbar`, `.dn z` "No rows in the {monthLabel} file", and `.go` "—" in muted.

### 11.9 ui/fluid.ts: the lower sections

- `Seg = { key, v, cls?: St | 'none', color?, ink?, label?, to?, title }`.
- `PourBar({ segs, e, h = 34, minShare = 0.05, label })`:
  - The container is `.tank`, plus `pouring` while `0 < e < 1`, with its height set. It has `role="img"` and aria-label "{label}: {titles joined ', '}".
  - Inside is `.pour`, clipped with `clip-path: inset(0 {100−p}% 0 0)` where `p = clamp(e)*100`.
  - Each segment with `v > 0` is `.seg {cls}` with `flex: v` and optional background and colour. Its inner label shows only when `v/total ≥ minShare`.
  - A segment is a SnapLink (title "{title} (open list)") when it has `to`, else a span.
  - Then comes `.edge` at `left: p%`, holding a wavy SVG (`viewBox="0 0 26 120"`, path `M13 0 C 26 10, 0 20, 13 30 S 0 50, 13 60 S 26 80, 13 90 S 0 110, 13 120 H0 V0Z`, `preserveAspectRatio="none"`). It is visible only while pouring.
- `statusSegs(s, to?, labels = true)` returns the segments done, wip and ns, each with label `fmtNum(n)` and title "{Label}: {n}".
- `CardHead({title, tip, right?})` renders `.fl-head`: an `<h3>` (20 px), then `<span class="fl-i" title={tip} aria-label={tip}>i</span>`, then the right-hand content.
- `Legend` renders `.fl-legend` with 3 dots and labels.
- `LevelStatusCard({ sum, N, base, unit })`, titled **"Status per level"**:
  - Tip: "Every level counts all {total} {unit}; a level with no row in the file counts as Not started. Click a segment for the list."
  - fill (150, 1500), then the Legend.
  - One `.fl-lvrow` per level, in a grid of 44px / 1fr / 84px:
    - a LvlChip;
    - a PourBar of status segs, each linking to `peopleUrl({...base, lv, ls})`, with `e` = `min(1, e*1.15 − i*0.05)`;
    - a `SnapLink class="fl-done"` "✓ {round(done*e)}" linking to `lv, ls=done` (title "L{n} completed").
- `FunnelGlasses({ sum, N, base, unit })`, titled **"Level funnel"**:
  - Tip: "Each glass is filled to its share of everyone; the pill between two glasses is the share that continues from the previous step."
  - fill (250, 1600).
  - The steps are:
    - `unit` with the first letter capitalised (e.g. "Enrollments" / "Employees"): v = total, colour `#cbd5e1`, links to `peopleUrl(base)`;
    - "Started": v = started, colour `#93c5fd`, no link;
    - one per level, labelled LvlChip + " ✓": v = that level's done count, colour = the ramp hex, links to `lv, ls=done`.
  - `conv[i] = steps[i].v / steps[i−1].v`. It is null for i = 0 and when the previous value is 0.
  - `worst` = the index i ≥ 2 with the minimum conv among those ≤ 1.
  - Each step is a `.g-col` (a SnapLink when linked). It holds:
    - `.g-lab`;
    - a `.glass` (`pouring` while filling) containing `.g-liq`, at height `max(share*100, v ? 3 : 0) * e` % and with the step colour, and an inner `.g-wave` SVG filled with that colour;
    - an n33 bignum `round(v*e)`;
    - `.g-sub` "{pct(v, total)}% of all".
  - Between glasses (for i > 0) sits a `.g-pill` reading "→ {pct(v, prev, 0)}%" (or "→ —"):
    - class `over` with `<small>⚠ more</small>` and title "More than the previous step: check the data" when conv > 1;
    - class `worst` with `<small>⚠ bottleneck</small>` and title "Lowest conversion: the bottleneck" when it is the worst step;
    - otherwise the title "Share that continues".
- `HighestCard({ sum, N, base, unit })`, titled **"Highest level completed"**:
  - Tip: "Each {employee|enrollment} is counted once, at the highest level they completed."
  - fill (350, 1500).
  - When `reached == 0`, a `.fl-note` reads "**No level completed yet.** {wip} {unit} are in progress."
  - A PourBar with `h = 55` and `minShare = 0.045` holds these segments:
    - "none": colour `var(--none)`, ink `#334155`, label `Two(n, "No level yet")`, links to `hi=0`, title "No level completed yet: {n}";
    - one per level: the ramp colour and ink, label `Two(n, "L{i}")`, links to `hi=i`, title "Highest L{i}: {n}".
  - `Two` renders `<span class="two"><b>{n}</b><small>{l}</small></span>`.
  - Below it, `.fl-keys` holds one `SnapLink class="fl-key"` per segment: a swatch `<i>`, the text "No level yet" or "L{i} highest", `<b>{n}</b>` and `<span>{pct}%</span>`.
- `BreakdownCard({ orgs, bands, base, multi })`, titled **"Breakdown"** with the tip "Each row opens the employee list for that group.":
  - On the right is `.fl-ctrls`:
    - a `.seg-tg` role=tablist ("Group by") with tabs "Reporting Orgn · {count}" and "Band · {count}";
    - `<label class="fl-sort">Sort <select class="sel">` with the options "Enrollments" (or "Employees" when not `multi`), "% started" and "Completed".
  - Sort (descending): total, started ratio, or done count, with `''` always last, then name.
  - It shows the first 8 rows. A `.bd-more` button toggles between "Show all {n} ▾" and "Show fewer ▴".
  - fill (200, 1300).
  - Each row is a `SnapLink class="bd-row [other when name '']"` linking to `peopleUrl({...base, org|band: name})`. The grid columns are `minmax(180px,1.2fr) 70px minmax(0,2.618fr) 110px 64px 20px`. Each row holds:
    - `.bd-name`: `orNone(name)`, plus `<small>{employees} employees</small>` when `multi`;
    - an n26 bignum total;
    - `.bd-bar` at width `max(8, total/max*100)%`, wrapping a 13 px PourBar of unlabeled status segs with `e` = `min(1, e*1.2 − i*0.03)`;
    - `.bd-st` "{pct(started, total, 0)}% started";
    - `.bd-dn` "✓ {done}", or "—" (with class `z`);
    - `.bd-chev` "›".
- `StatRow({ sum, totalLabel, totalSub, to?, active? })` is a `.g4` of compact cards (`.lq.sm`, min-height 144):
  - first, the total card (n42) with the given label and sub;
  - then In progress, Completed and Not started (i = 1..3), with liquid, `to(k)` links, the sub "{pct}% of total", and n42 numbers.
  - When `active` is set, the matching card gets `state="selected"` (a ring in its status colour: done `#15803d`, wip `#2563eb`, ns `#64748b`) and the corner tag "✓ Filter on". The others get `dim` (opacity .5).
- `NumberTile({ i, label, value, sub? })` is a compact LiquidCard without liquid, showing an n42 number.

### 11.10 `PeopleTableComponent` (`app-people-table`) and `exportPeopleCsv` (ui/shell.ts)

- `LevelStatusChips({e})` renders one `.st {status}` chip per level reading "L{n}" plus a symbol: ✓ done, ◐ wip, – ns.
  - Title "L{n}: {Label}{ · ETA {date}}"; aria-label "L{n} {Label}".
- `exportPeopleCsv(list, N, fileName)` writes these headers:
  - `Emp ID, Name, Email ID, Reporting Orgn, Band, HyperScaler, Status, Highest level completed`;
  - then, for each level 1..N: `L{n} status, L{n} ETA`.
  - Values: the status label; "L{h}" or "None" for the highest level; then each level's label and ISO ETA.
- `PeopleTable({ list, N, hideHs?, toolbar?, limit? })` renders `.panel overflow-hidden` with the toolbar on top.
  - An empty list shows `.empty m-4` "Nobody matches these filters."
  - Otherwise it shows a `table.data` with these columns:

| Column | Sortable | Content |
|---|---|---|
| Emp ID | yes | `font-mono text-[12.5px]` |
| Name | yes | semibold, "—" muted if empty |
| Email ID | no | a `mailto:` link (`link font-normal`), or "—" |
| Reporting Orgn | yes | the value, or muted "Not given" |
| Band | yes | the value, or muted "Not given" |
| HyperScaler | yes | hidden with `hideHs`; a SnapLink to `hsUrl` |
| Levels (L1–L{N}) | yes, by highest | the level chips |
| Status | yes | a dot plus the label |
| Latest ETA | yes | `fmtIso` |

  - Sorting:
    - The default is Emp ID ascending.
    - Clicking a new column sorts ascending, except Levels (highest), which starts descending. Clicking the same column flips the direction.
    - The order is shown as " ▴" / " ▾", and the header gets `aria-sort`.
    - Status order is done, wip, ns. An empty latest ETA sorts as "9999". Text compares lower-cased.
    - The tie-break is `empId.localeCompare(…, undefined, { numeric: true })`.
    - Changing the sort resets the page to 0.
  - Paging is 50 per page. When there's more than one page, a `.pager` footer shows "{from}–{to} of {n}", a "‹" button, "Page {p} of {pages}" and a "›" button, with aria-labels "Previous page" / "Next page".
  - With `limit`, only the first `limit` sorted rows are shown and there's no pager.

---

## 12. Pages

### 12.1 Shared `GateComponent` (`app-gate`) and `LevelsBodyComponent` (`app-levels-body`), in pages/views.ts

- `GateComponent` wraps its page with `<ng-content/>` and reads `DataService`:
  - while loading, and only when nothing is loaded yet (`loading() && !snapshotId()`), it shows `<div class="page muted">Loading…</div>`. A month switch keeps showing the old data until the new one arrives.
- Inside the gate, the Overview and HyperScaler pages wrap their content in `@if (data.snapshotId(); as id) { … }`.
- On error: `.empty big` with "**Couldn't load the data**" and the error message.
- With no snapshot or no enrollments: `.empty big` containing:
  - "○" at 28 px;
  - "**No data yet**";
  - "Upload this month's sheet (Emp ID, Name, Reporting Orgn, Band, HyperScaler, ETA (Date), Certificate done/WIP, Certification Levels, Email ID).";
  - a `SnapLink class="btn primary mt-2"` to `/upload`: "Upload the monthly sheet →".

`LevelsBodyComponent` (`app-levels-body`, inputs `d`, `base`, `unit`) is shared by Overall and each HyperScaler. In `ngOnChanges` it computes the list (`applyFilter(base)`), the summary and the org/band groups, then renders:
- `.sec` "Levels".
- If `d.N > 0`: `FunnelGlasses`, then a `.grid2` with `LevelStatusCard` and `HighestCard`.
- Otherwise `.empty` with "○" and "**No Certification Levels in this file.** Every row has an empty level, so per-level status can't be shown."
- `.sec` "Breakdown", then `BreakdownCard` with `multi = !base.hs`.

### 12.2 `OverviewPage` (`/`, pages/views.ts)

From top to bottom:
1. `HsTabs`, with Overall active.
2. `.page.stack`, containing:
   - `.vhead`: `<h2>Overall</h2>` (33 px) and `.meta` "{Mon YYYY} data · uploaded {snapshotLabel} · {k} HyperScalers with data · {N} levels · {rowCount} rows in the file";
   - `.sec` "Status", then `StatusCards(summary, base {})`;
   - `.sec` "Key insights", then `InsightCards(summary, quality, {})`;
   - `.sec` "HyperScalers", then `HsCards(d, dataMonth)`;
   - `Body(unit="enrollments")`.

### 12.3 `HyperScalerPage` (`/hs/:name`, pages/views.ts)

Angular wiring:
- `name = toSignal(route.paramMap.pipe(map(p => p.get('name') ?? '')), { initialValue: '' })`.
- `filter` (`{ hs: name }`), `crumbs`, `shown`, `base` (is a base HyperScaler), `known` (base or known), `levels` and `view` are all `computed`.
- `view` = `null` when the HyperScaler has no data; otherwise `{ list, sum, quality: subsetQuality(list, sum, d.quality.profileConflicts) }`.
- The `.meta` line, the Stepper and the empty state follow from these.

- `base = { hs: name }`.
- The header block holds:
  - `HsTabs` with this HyperScaler active;
  - a Breadcrumb "Overall › {name}";
  - a `.page.stack` (paddingBottom 0) with `.vhead`: a small HsLogo, then a div containing `<h2>{name}<NewTag/></h2>` and `.meta`, and on the right the `Stepper` over `shownHyperscalers`, shown only if the name is in that list.
- If the HyperScaler has no rows this month:
  - The meta reads "HyperScaler · no rows this month" for a base HyperScaler, else "Not in this month’s data".
  - It is followed by `.empty big` with "○" and "**No {name} rows in the {Mon YYYY} file.**" (for base or known HyperScalers) or "**{name} isn't in this month's data.**", plus a link "← Back to Overall".
- Otherwise:
  - The meta reads "HyperScaler · {total} employees · {levelsFor(name)} levels".
  - Then come:
    - `.sec` "Status" (margin-top 0), then `StatusCards(sum, base, parent = overall summary)`;
    - `.sec` "Key insights", then `InsightCards(sum, subsetQuality(list, sum, d.quality.profileConflicts), base, parent)`;
    - `Body(unit="employees")`;
    - an employees block:
      - `.h2` "Employees on {name}";
      - `.h2-sub` "First 10 by Emp ID · Emp ID, Email ID and the status of every level";
      - on the right, `SnapLink class="btn sm ghost ml-auto"` "Open the full list ({n}) ›", linking to `peopleUrl(base)`;
      - then `PeopleTable(list, hideHs, limit 10)`.

### 12.4 `PeoplePage`, pages/people.ts (`/people?hs=&org=&band=&st=&lv=&ls=&hi=&flag=`)

**Reading the filter from the URL**
- `hs`, `org` and `band` apply whenever present (they can be empty strings).
- `st` must be one of the status keys.
- `lv` + `ls` apply only together, with `lv` an integer ≥ 1 and `ls` a status.
- `hi` must be an integer.
- `flag` must be one of `skip | dup | nolevel | over`.
- Search `q` is local state, not stored in the URL.

**Filter chips**
| Condition | Chip text | Removes |
|---|---|---|
| hs | "HyperScaler: {hs}" | `hs` |
| org | "Reporting Orgn: {orNone}" | `org` |
| band | "Band: {orNone}" | `band` |
| st | "Status: {Label}" | `st` |
| lv + ls | "L{lv}: {Label}" | `lv`, `ls` |
| hi | "Highest completed: L{hi}", or "No level completed yet" for 0 | `hi` |
| flag | the flag label | `flag` |

Flag labels:
- skip "Completed a level above an uncompleted one";
- dup "Has duplicate rows";
- nolevel "Has rows with an empty level";
- over "Has rows above its HyperScaler's levels".

The hs chip is of kind hs, the st and lv+ls chips are of kind status, and the rest are of kind other.

**Heading**
- The heading text is `filter.hs`, else the first "other" chip label, else "All employees".
- The context line holds the other chip labels joined by " · ". The first one is dropped when it was already used as the heading.
- The breadcrumb reads "Overall › {hs, linked to its view, when present} › Employees".

**Layout**
1. `.vhead` with:
   - `.ph-title`: a small HsLogo (when hs), `<h2>`, then an `.st-badge {st}` "● {Label}" (`role="status"`, keyed so it pops on change) and/or `.st-badge {ls}` "● L{lv} · {Label}";
   - `.ph-context` with the context line;
   - `.meta` "{n} enrollment(s) · {m} employee(s) · one row per employee × HyperScaler".
2. `StatRow`:
   - it isn't re-created when the filters change, so the fill plays once per page visit;
   - total label "In this list" and sub "{m} employee(s) · {n} enrollment(s)";
   - `active = filter.st`.
   - Each status card links to `/people?{current params without snapshot, with st=k}`. Clicking the active status removes `st`. SnapLink re-adds the snapshot.
3. A `PeopleTable` whose toolbar (`flex flex-wrap items-center gap-2 px-4 py-3 border-b`) holds:
   - a `.search w-[280px]` with the Search icon and an input (placeholder "Search Emp ID, name, email…", aria-label "Search employees");
   - `select.sel`s, where choosing the `__all` value deletes the param:
     - "All HyperScalers" plus the HyperScalers with data;
     - "All Reporting Orgns" plus the sorted distinct orgs (shown with `orNone`), `max-w-[200px]`;
     - "All Bands" plus the bands;
     - "Any status" plus the 3 statuses. This one takes the status colour when set (`st-sel {st}`).
   - an "Export CSV" button with the Download icon (`btn sm ghost ml-auto`), disabled when the list is empty;
   - when there are chips, a full-width row with `.k` "Filters", the `.fchip`s (status chips get the status colour and a dot, and the hs chip has a white background and the logo), each with a "×" button (aria-label "Remove filter {label}"), and a "Clear all" link button.
   - Export file name: `employees-{Mon-YYYY or 'data'}{-chipLabel with [^A-Za-z0-9]+→_ …}.csv`, truncated to 150 characters.
4. A 12 px muted footnote: "Status = Completed when the top level (L{N}) is completed, In progress when any level is started, otherwise Not started. Hover a level chip for its status and ETA. ✓ completed · ◐ in progress · – not started."

Loading and error states: "Loading…" (when `loading() && !snapshotId()`), or `.empty big` with the error message.

Angular wiring:
- `params = toSignal(route.queryParamMap, { requireSync: true })`, `filter = computed(() => readFilter(params()))`, `q = signal('')` (the search box binds `[value]`/`(input)`).
- `list`, `sum`, `employees`, `totalSub`, `orgs`, `bands`, `chips`, `heading`, `contextLine` and `crumbs` are all `computed`.
- The selects bind `[value]` / `[selected]` and `(change)`.
- `setParam(k, v)` and `remove(keys)` call `router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge' })`. They set `null` to delete a param, so `snapshot` is kept.
- `statusLink(k)` builds `/people?…` from the current params without `snapshot` and `st`, and adds `st=k` unless `k` is already active. The `snapLink` directive re-adds the snapshot.
- The status badge and the filter chips use class bindings (`[class.st-chip]`, `[class.hs-chip]`, `[class.done|wip|ns]`).

### 12.5 `UploadPage` (`/upload`, pages/upload.ts)

- Breadcrumb "Overall › Upload monthly sheet".
- `h1.title` "Upload this month's sheet".
- `.sub`: "One row per employee × HyperScaler × level. The file is saved as **{Mon YYYY of today}** data (the upload month) in `local-data/`; earlier months stay available in the history."
- When past: an amber note reading "You're viewing past data. Go back to the latest data to upload."

**Drop zone `.drop`**
- It's clickable and keyboard-accessible (Enter/Space), `role="button"`, aria-label "Choose a spreadsheet to upload", with drag-over styling via `.over`.
- It contains a hidden `<input type="file" accept={extensions} data-testid="file-input">`, whose value is reset after each pick.
- Content:
  - a white 64 px rounded tile with the File icon;
  - the heading "Drag & drop the monthly Excel file here", or "Drop another file to replace" once a file is loaded;
  - "or <span class=link>browse files</span> · .xlsx, .xls, .xlsb, .ods, .csv, .tsv";
  - before any file, 9 pills "1. Emp ID" … "9. Email ID".

**File handling**
- Picking a file clears the errors and the choices.
- A wrong extension gives: `"{name}" isn't a spreadsheet. Use one of: {exts joined ', '}`.
- No sheets gives: "No table found in this file. Make sure it has a header row with the column names."
- A read failure gives: "Couldn't read this file: {message}".
- Errors are shown as a `pill r` block. Errors loading saved choices are shown the same way.
- Saved mappings are loaded once in `ngOnInit` with `fetchMappings()` into the private signal `saved`. `savedLoading` and `savedError` signals track progress. All derived state (`sheet`, `missing`, `mappings`, `validation`, `preview`, `errors`, `warnings`, `undecided`, `stats`, `hsOptions`, `levelOptions`, `statusList`, `levelList`, `fileHint`) is `computed`.
- Choices are changed with `choose('status', key, value)`, `chooseLevel(key, v)` and `chooseHs(h, v)`; choosing the default `h.name` deletes the entry.
- The drop zone uses `(dragover)`, `(dragleave)`, `(drop)`, `(keydown.enter)` and `(keydown.space)`, plus a `#input` template reference for `input.click()`.
- The validation runs only when a file is loaded, no required column is missing and the saved mappings have loaded. It uses `merge(saved, choices)` (per-kind spread) and `savedHsKeys` = the keys of the **saved** hyperscaler mappings.

**After a file is loaded**
1. A file panel with:
   - an extension badge (a 42 px green tile, up to 4 characters, upper-case);
   - the file name;
   - "{KB} KB · header on row {n} · {rows} rows", followed, once validated, by " · {employees} employees · {enrollments} enrollments · {k} HyperScalers · {max level} levels";
   - a "Sheet" `select` when the workbook has more than one sheet (each option reads "{name} ({rows} rows)"). Changing it re-runs the column auto-mapping.
   - a status pill:
     - "{n} column(s) to map" (amber);
     - "{n} value(s) need your decision" (amber);
     - "✓ Ready" (green).
2. **Decisions** panel, `.decide`, `role="region"`, aria-label "Needs your decision".
   - It's shown when there are undecided values, or new HyperScalers, or any status/level choice made on this screen.
   - Title "Needs your decision" (`#92400e`), with the sub "These values aren't covered by the rules. Your choice is remembered and applied automatically to future uploads."
   - A table with the columns Column, "Value in file", Where, and "Treat as" (280 px).
   - The Where cell reads "{count} · rows a, b, c, d, e…" (the first 5 rows), or "decided" for values already chosen on this screen, which stay listed.
   - Status rows ("Certificate done/WIP", `"{raw}"` in bold) have a select with "Choose…", Completed, "In progress", "Not started" and "Skip these rows". Its aria-label is `Status for "{raw}"`, and it gets the red `.need` style while undecided.
   - Level rows ("Certification Levels") have a select with "Choose…", L1…L{max(4, max level in the file, dataset N)+1} and "Skip these rows". Its aria-label is `Level for "{raw}"`.
   - New HyperScaler rows ("HyperScaler" plus a `.tag-new` "new") have a select whose default option is `Add as a new HyperScaler "{name}"`, then "Same as {X}" for every known HyperScaler and every HyperScaler in the current data except itself. Choosing the default clears the choice. Its aria-label is `HyperScaler for "{raw}"`.
3. A two-column grid (`grid-cols-[320px_1fr]`):
   - Left, the **Column check** panel: one row per field, "{i}. {label}", with "(optional)" for the optional ones.
     - Each row has a select: "✗ Choose column" (required) or "— Not in file" (optional), then "✓ {header or 'Column n'}" for each header.
     - The select is green when mapped, red when a required field is missing, and muted otherwise.
   - Right:
     - **Preview**: " · first {min(8, n)} of {n} rows ready to save". It's a table with "Row" plus the 9 labels.
       - Each row shows the source row (muted), the values, the ETA via `fmtIso` or "—", the status dot and label, the level as `L{n}` or "—", and the email.
       - Before validation it shows "Loading your saved choices…" or "Map the required columns to see a preview."
     - **Rows needing attention** (when there are issues): a "{n} will be skipped" red pill and a "{n} warnings" amber pill.
       - It's a table with Row "#{n}" (80 px), Emp ID (120 px; "—" if empty), Issue (as a red or amber pill) and Value (muted).
       - It shows the first 10, then "+{n} more. Download the full list from the import summary."
4. An import error, if any: "Import failed: {message}".
5. The footer row:
   - On the left, `.sub mr-auto`, one of:
     - "Map {labels} to continue.";
     - "Decide the {n} value(s) above to continue.";
     - "{n} rows will be saved as **{Mon YYYY}** data: `{first 13 characters of the would-be id}…csv`".
   - "Cancel" (`btn ghost`), which unloads the file.
   - "Save this month →" (`btn primary`), which reads "Saving…" while busy. It's disabled when busy, past, not validated, there are 0 rows, or values are undecided.

**Import**
1. Build `hsDefaults`: for every new HyperScaler, `choices.hyperscaler[key] ?? name`, so "kept as new" is remembered as itself.
2. Save `merge(saved, {...choices, hyperscaler: {...choices.hyperscaler, ...hsDefaults}})` with `PUT /api/mappings`.
3. Call `runImport(rows without sourceRow, latestDoneDate)`.
4. `await data.afterUpload()`, which refreshes the snapshot list and reloads latest.
5. `router.navigateByUrl('/uploads/{id}', { state })` with the router state `ImportNavState`, defined and exported in `pages/uploads.ts`:
   - `fileName`, `sheetName`, `issues`, `rowsSaved`, `skippedByChoice`;
   - `decisions: string[]`, made of:
     - `Status "{key}" → {Label | rows skipped}`;
     - `Level "{key}" → {L{n} | rows skipped}`;
     - `HyperScaler "{raw}" added as new` or `HyperScaler "{raw}" → {target}`;
   - `newHyperscalers`: the names of those kept as new.

### 12.6 `UploadsPage` (`/uploads`, pages/uploads.ts)

- Breadcrumb "Overall › Uploads".
- `h1.title` "Monthly uploads", with the sub "Each upload is one month's data (the month it was uploaded), kept as its own file in `local-data/`. Open any month to see the dashboard as it was."
- The panel shows:
  - when empty: `.empty big` with "**No uploads yet.**" and a link "Upload this month's sheet →".
- Otherwise it's a `table.data` with these columns:
  - "Data month": bold, plus a `pill i` "Latest" on the first row;
  - "Uploaded": fmtDateTime;
  - "Latest completion in file": fmtDate(dataUpTo);
  - "File": monospace muted `{id}.csv`;
  - "Size": right-aligned, "{KB} KB";
  - "Actions" (330 px), with three buttons:
    - `btn sm primary` "View this data" navigates to `/` for the first row, else `/?snapshot={id}`;
    - `btn sm ghost` "Summary" opens `/uploads/{id}`;
    - `btn sm ghost` "CSV" downloads `{id}.csv` (aria-label "Download {id}.csv").
- There is no separate loading state: it renders from `data.snapshots()` and shows the empty state until the list arrives.
- This page uses plain `router.navigate(['/'], { queryParams: id ? { snapshot: id } : {} })`, `router.navigateByUrl('/uploads/' + id)` and `routerLink="/upload"`, not snapLink.

### 12.7 `ImportSummaryPage` (`/uploads/:id`, pages/uploads.ts)

- An invalid id shows `.empty big` "Unknown upload.". It also has loading and error states.
- `id` comes from `route.snapshot.paramMap`, and `valid = isSnapshotId(id)`.
- The router state is read from `inject(Router).getCurrentNavigation()?.extras.state`, falling back to `history.state` when it has a `fileName`, else `null`.
- In `ngOnInit` it loads the rows with `await data.snapshot(id)` into `ds = signal<Dataset | null>`, then `buildDataset`. Errors go to an `error` signal.
- The order of states is: invalid → "Unknown upload.", error → `.empty big` with the message, no dataset yet → "Loading…".
- `viewUrl` and `tiles` are `computed`. The view URL is `/` when this snapshot is the latest, else `/?snapshot={id}`.
- Breadcrumb "Overall › Uploads › {Mon YYYY} data".
- `.vhead` holds:
  - `<h2>`: "✓ Saved: " (only when arriving with router state), then "{Mon YYYY} data";
  - `.meta` "Uploaded {snapshotLabel}", then, with state, " · from **{fileName}** (sheet {sheetName})", then " · `{id}.csv`";
  - on the right, `SnapLink class="btn primary ml-auto"` "View the dashboard →".
- A `grid grid-cols-5 gap-[21px]` of `NumberTile`s: "Rows saved" (rowCount), "Employees", "Enrollments" (sub "employee × HyperScaler"), "HyperScalers" and "Levels" (N).
- `.sec` "Status in this month", then `StatRow(summary, "Total enrolled", "{employees} employees")`, with static cards.
- `.sec` "Checks":
  - With state, a `.grid2`:
    - a `.card` titled "From the upload", listing:
      - "**{rowsSaved}** rows saved", followed by ", **{e}** skipped because of errors" (in red), ", {n} skipped by your choice" and ", {w} warnings", then ".";
      - if any new HyperScalers: a `.tag-new` "flag", then "New HyperScaler(s) added automatically: **{names}**";
      - if any decisions: "Your choices (remembered for next time):", with a muted disc sub-list;
      - when there are issues, a button "Download all {n} row issues (CSV)" that downloads `{id}-issues.csv`.
    - `DataQuality(quality, summary, base {})`.
  - Without state, only `DataQuality`.

---

## 13. Branding assets

- `src/assets/brand/logo.svg` (served as `assets/brand/logo.svg`) is a **placeholder** wide wordmark (340×60): two overlapping rounded squares with an indigo→cyan gradient, "YOUR COMPANY" in 25 px weight 800, and "TECHNOLOGIES PRIVATE LIMITED" in 13 px. See Appendix E.
- `src/favicon.svg` is a 32×32 indigo (`#4F46E5`) rounded square with a white outlined star. See Appendix E.
- To rebrand, replace `logo.svg` (keeping the file name) and set `BRAND.name` in `src/app/lib/brand.ts`. When the version in `package.json` changes, update `APP_VERSION` there too.

---

## 14. Sample data and tests

### 14.1 `scripts/make-fde-sample.mjs`
- Deterministic, with a seeded linear congruential generator (seed `20261118`). It writes 446 rows to `local-data/test/fde-sample-nov-2026.xlsx`, or to the path given as the first argument.
- The sheet is named "Nov 2026".
- It includes deliberate edge cases:

| Emp ID | Edge case |
|---|---|
| E29001 | "Certified" ×2 |
| E29002 | "Foundation" level |
| E29003 | "Oracle Cloud" ×3 |
| E29004 | duplicate L1 (WIP + Completed) |
| E29005 | L2 done while L1 is in progress |
| E29006 | an empty level |
| (no ID) | a row with a missing Emp ID |
| E29007 | only an L1 row |
| E29008 | 60 % stored as an Excel number formatted `0%` |

- Some ETAs are Excel serials formatted `dddd, mmmm dd, yyyy`.
- Copy it verbatim from Appendix G. Generate the test fixture with `node scripts/make-fde-sample.mjs src/app/test/fixtures/fde-sample.xlsx`.
- `scripts/make-fde-sample-oct.mjs` is the same script, for a second (October) month, so you can try comparing months in the UI. It differs only in these places:
  - output `local-data/test/fde-sample-oct-2026.xlsx`;
  - seed `20261018`;
  - sheet name "Oct 2026";
  - start dates use `1 + floor(rnd*4)` months, and completion dates are capped at 17 Oct 2026 (`day(2026, 10, 2 + lv)`);
  - in-progress ETAs are in November 2026;
  - the edge-case dates move one month earlier: E29001 5 Sep / 2 Oct; E29003 L2 20 Nov; E29004 1 Sep / 30 Sep; E29005 15 Nov / 20 Sep; E29006 10 Oct; E29008 20 Dec 2026.

### 14.2 Vitest suites (`npm run test:lib`, all must pass; files in `src/app/test/`, Node environment)

**`rules.test.ts`**
- Every HyperScaler alias in §7.3 resolves correctly, including the "… FDE" variants. "Oracle Cloud", "Red Hat", "FDE" and "" return null.
- `sortHyperscalers(['Zeta','Red Hat OpenShift','Google','Oracle','GitHub','Anthropic','AWS','Azure'])` returns `['Anthropic','Azure','AWS','Google','GitHub','Red Hat OpenShift','Oracle','Zeta']`.
- `shownHyperscalers([])` returns the base 4. `shownHyperscalers(['GitHub','AWS','Oracle Cloud'])` returns the base 4 followed by GitHub and Oracle Cloud.
- The status and level cases from §7.2.
- Dates:
  - "Wednesday, November 18, 2026", "Wed, Nov 18, 2026" and "November 18, 2026" all give 2026-11-18;
  - "Thursday, January 7, 2027" gives 2027-01-07;
  - the serial 46344 gives 2026-11-18, and `46344−1462` with the 1904 system gives 2026-11-18;
  - "2026-10-01" and "01-10-2026" give 2026-10-01; "18/11/26" gives 2026-11-18;
  - "soon" and "Wednesday, February 30, 2026" give null.
- The exact 9 headers map to indexes 0–8 with nothing missing.
- `levelRamp(n)` gives n distinct colours for n = 1, 3, 4, 6, 9.

**`snapshotName.test.ts`**: the examples in §7.8. Ordering by upload time: `['301226-020127-080000','151126-181126-093005','011126-181126-120000']` sorts to `['151126-181126-093005','011126-181126-120000','301226-020127-080000']`.

**`aggregate.test.ts`**
- Level-config tests:
  - the default is 4;
  - Completed needs L4;
  - the override `{Azure: 3}` gives per-level totals `[2,2,2,1]`;
  - L5/L6 rows count as `overRows`.
- A 14-row fixture with a 3-level config (7 employees, 8 enrollments):
  - per-level counts `[{4,2,2},{2,1,5},{1,0,7}]`;
  - status counts `{done 1, wip 5, ns 2}`;
  - highest `{none 3, byLevel [3,1,1]}`;
  - a duplicate resolved to done, keeping its ETA;
  - a profile conflict on Reporting Orgn;
  - the "Not given" group sorted last;
  - the filters;
  - increasing-level detection;
  - an empty file.

**`pipeline.test.ts`** (fixture path `path.resolve(__dirname, 'fixtures/fde-sample.xlsx')`), on the fixture with TODAY `2026-11-18`:
- With empty mappings:
  - unknown status `[['Certified',2]]`, unknown level `[['Foundation',1]]`, new HyperScaler `[['Oracle Cloud',3]]`;
  - exactly one error, "Missing Emp ID (row skipped)";
  - rows = sheet rows − 1 − 3.
- With remembered `{status:{certified:'done'}, level:{foundation:1}, hyperscaler:{oraclecloud:'Oracle Cloud'}}`:
  - nothing is unknown;
  - the HyperScalers are `['Anthropic','Azure','AWS','Google','Oracle Cloud']`, with added `['Oracle Cloud']`;
  - N = 4;
  - the completion counts don't increase from level to level;
  - each edge case resolves as listed;
  - more than 100 ETAs are parsed, all in 2026/2027;
  - the CSV round-trip is lossless;
  - an L5 row produces the warning "L5 is above AWS's 4 levels: it won't be counted";
  - an old-format CSV throws `OldFormatError`.

### 14.3 Browser scripts (dev tooling, playwright-core plus the installed Edge, headless, viewport 1440×900)

- `scripts/e2e.mjs <screenshotDir>` reads the fixture from `src/app/test/fixtures/fde-sample.xlsx`. It runs against an app on `BASE_URL` (default `http://localhost:5174`) whose API uses an **empty** data dir: start `LOCAL_DATA_DIR=<abs path to .e2e-data> node ../api/server.mjs` and `ng serve --port 5174`, and pass the same `LOCAL_DATA_DIR` to the script so it can read `mappings.json`. It checks, in order:
  - the empty state shows "No data yet";
  - uploading the fixture shows the decisions region; Save is disabled; "Add as a new HyperScaler "Oracle Cloud"" is present;
  - after choosing Certified→done and Foundation→1, Save is enabled; saving lands on `/uploads/<id>` showing "Saved:"; `mappings.json` contains the 3 choices;
  - re-uploading needs no decisions and saves a second, different snapshot;
  - on the Overview:
    - "Status per level" is shown;
    - the footer shows "© {year}";
    - the header fits at 1440 and 1280 px, and the logo loads;
    - the funnel flags a step;
    - the cards start with Anthropic|Azure|AWS|Google;
    - Oracle Cloud has a card with "new";
    - after 2.2 s no `.lq.moving` remains;
    - the In progress card goes to `/people?st=wip`;
  - the AWS card opens `/hs/AWS`, showing "3 of 5", and the stepper "Google ›" works;
  - `/hs/Oracle%20Cloud` shows "added from file";
  - the second `.fl-done` goes to `?lv=2&ls=done`, with the chip "L2: Completed";
  - the Band tab shows rows starting with "B";
  - the first org row opens `?org=`; the Export CSV header starts `Emp ID,Name,Email ID,Reporting Orgn,Band,HyperScaler,Status`;
  - the Data checks card opens, and its first link adds `flag=`;
  - the Month picker's second option shows "You're viewing", and `snapshot=` is kept when clicking the Google subtab;
  - Uploads lists 2 rows.
- `check-pages.mjs [baseUrl]` is a read-only sweep of all routes. Its default base URL is `http://localhost:9009`, so pass `http://localhost:4200`. It reports page errors, console errors and failed or ≥ 400 requests.
- `settled-shots.mjs <baseUrl> <outDir> <path>=<name> …` takes screenshots after a 2.6 s settle. `shot.mjs <outDir> <width> <file.html[?q]>=<name> …` screenshots local HTML files.

---

## 15. README.md

The repo-root README covers:
- run: `cd apps/web-ng && npm install && npm start`, which starts the API on http://localhost:9010 and the app on http://localhost:4200. `npm run start:api` and `npm run start:web` start them separately;
- the sheet format table (§7);
- the HyperScaler, status, level and ETA rules;
- remembered choices;
- how the numbers are built (§8);
- months and history (snapshot naming, Month ▾, Uploads → View this data, old-format snapshots in `local-data/archive-old-format/` are not loaded);
- the views/routes table;
- the "›" navigation rule;
- the scripts table (`npm start`, `npm run build`, `npm run typecheck`, `npm run test:lib`, `npm run sample`, the browser scripts);
- the code map (`apps/api/server.mjs`, `src/app/core`, `src/app/lib`, `src/app/ui`, `src/app/pages`).

`apps/web-ng/README.md` stays the Angular CLI default. `.vscode/` has the CLI defaults: it recommends `angular.ng-template`, has launch configs "ng serve" (Chrome on :4200) and "ng test" (:9876), and npm tasks `start`/`test` with background matchers ending on "bundle generation complete".

---

## 16. Acceptance checklist

- `npm run typecheck`, `npm run test:lib` and `npm run build` all pass. The production build stays within the 800 kB initial-bundle warning budget, because the Upload page and SheetJS are lazy-loaded.
- The empty app shows "No data yet". Uploading the generated sample asks for exactly 2 decisions and flags Oracle Cloud. After saving, the Overview shows:
  - 4 status cards (Total enrolled, In progress, Completed, Not started);
  - 4 insight cards;
  - HyperScaler cards (the base 4 first, then Oracle Cloud flagged "new");
  - the level funnel with a bottleneck pill, Status per level, Highest level completed, and the Breakdown.
- Every number, bar segment, card and row with › opens the matching filtered Employees list.
- Past months are read-only, Upload is disabled, and the snapshot param survives navigation.
- Animations run once on load, then the page is completely still. The hover wave freezes in place when the pointer leaves.

---

# Appendices (verbatim source: copy exactly)

## Appendix A: src/styles.css

`apps/web-ng/src/styles.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* AI Academy FDE Dashboard — tokens from the approved redesign (mockups/fde-redesign/fde.css) */
:root {
  --bg: #f4f6fb;
  --card: #ffffff;
  --line: #e3e8f2;
  --ink: #0f1b3d;
  --ink-2: #44506b;
  --muted: #6b7690;
  --brand: #1d4ed8;
  --brand-600: #1e40af;
  --wash: #eef2ff;
  /* status — fixed, never reused for anything else */
  --done: #16a34a;
  --wip: #2563eb;
  --ns: #94a3b8;
  --none: #e2e8f0; /* "no level completed yet" (absence) */
  --amber: #b45309;
  --amber-bg: #fffbeb;
  --red: #dc2626;
  --red-bg: #fef2f2;
  --green-bg: #ecfdf3;
  color-scheme: light;
}


html,
body {
  background: var(--bg);
  color: var(--ink);
  font-family: 'Manrope Variable', 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
button, input, select { font-family: inherit; }

/* ---------- header ---------- */
/* App shell: header on top, footer at the very bottom even on short pages */
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.app-main { flex: 1 0 auto; }

/* Header (design W2): one light bar; wide wordmark logo · title · navigation · Month · Upload */
.app-hdr { background: #fff; border-bottom: 1px solid var(--line); box-shadow: 0 1px 2px rgba(15, 27, 61, .04); padding: 10px 40px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 30; min-width: 0; }
.app-hdr > * { flex-shrink: 0; }
.app-brand { display: flex; align-items: center; }
/* wide wordmark: capped so even a long logo never pushes the controls out */
.app-logo { display: block; height: 40px; width: auto; max-width: 360px; object-fit: contain; }
.app-sep { width: 1px; height: 30px; background: var(--line); }
.app-title { font-size: 17px; font-weight: 800; letter-spacing: -.01em; color: var(--ink); white-space: nowrap; margin-right: auto; }
.hnav { display: inline-flex; background: #f1f4fa; border-radius: 10px; padding: 3px; }
.hnav a { padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.hnav a:hover { color: var(--ink); }
.hnav a.active { background: #fff; color: var(--brand); box-shadow: 0 1px 3px rgba(15, 27, 61, .12); }
.app-hdr .chip b { font-weight: 700; }
.mon-tag { font-size: 11px; font-weight: 700; color: #1e3a8a; background: #eef2ff; border-radius: 999px; padding: 1px 7px; }
.app-hdr .chip.past { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
.app-hdr .chip.past .text-muted { color: #92400e; }
.mon-tag.past { color: #92400e; background: #fef3c7; }
.btn-up { background: var(--brand); color: #fff; border-radius: 9px; padding: 0 14px; height: 34px; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; white-space: nowrap; }
.btn-up:hover:not(:disabled) { background: var(--brand-600); }
.btn-up:disabled { opacity: 0.5; cursor: not-allowed; }
@media (max-width: 1100px) { .app-hdr { flex-wrap: wrap; } .app-sep { display: none; } }

/* Footer (design F2): logo + copyright · data month, last upload, version */
.app-ftr { background: #fff; border-top: 1px solid var(--line); padding: 16px 40px; display: flex; align-items: center; gap: 13px; font-size: 14px; color: var(--ink-2); margin-top: var(--s4, 34px); flex-wrap: wrap; }
.ftr-logo { height: 22px; width: auto; max-width: 200px; object-fit: contain; }
.ftr-right { margin-left: auto; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.ftr-ver { font-size: 12px; font-weight: 700; color: #1e3a8a; background: #eef2ff; border-radius: 999px; padding: 2px 9px; }

/* HyperScaler sub-tabs */
.subtabs { display: flex; gap: 2px; padding: 8px 40px 0; border-bottom: 1px solid var(--line); background: #fff; overflow-x: auto; }
.subtabs a { padding: 10px 16px; font-size: 13.5px; color: var(--ink-2); border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap; }
.subtabs a b { color: var(--ink); margin-right: 4px; }
.subtabs a small { color: var(--muted); font-size: 12px; }
.subtabs a:hover { color: var(--brand); }
.subtabs a.on { border-color: var(--brand); color: var(--brand); }
.subtabs a.on b { color: var(--brand); }

.bc { padding: 14px 40px 0; font-size: 13px; color: var(--muted); display: flex; gap: 8px; align-items: center; max-width: 1480px; margin: 0 auto; flex-wrap: wrap; }
.bc a { color: var(--brand); font-weight: 600; }
.bc .sep { color: #a3acc2; }
.bc b { color: var(--ink); }

/* ---------- layout ---------- */
.page { padding: 18px 40px 48px; max-width: 1480px; margin: 0 auto; }
.stack { display: grid; gap: 18px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 2px rgba(15, 27, 61, 0.04); min-width: 0; }
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 1px 2px rgba(15, 27, 61, 0.04); }
.h2 { font-size: 16px; font-weight: 800; }
.h2-sub { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }
.k { font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.muted { color: var(--muted); }
h1.title { font-size: 24px; font-weight: 800; }
.sub { color: var(--muted); }
.vhead { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.vhead h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; }
.vhead .meta { color: var(--muted); font-size: 13.5px; }
.prov { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--wash); color: #1e3a8a; font-weight: 800; font-size: 11px; border: 1px solid #dbe4ff; flex: none; }
.prov.lg { width: 44px; height: 44px; border-radius: 12px; font-size: 13px; }
.tag-new { font-size: 10.5px; font-weight: 700; color: var(--amber); background: var(--amber-bg); border: 1px solid #fde68a; border-radius: 6px; padding: 1px 6px; margin-left: 6px; vertical-align: 1px; }

/* type tiers */
.t1 { font-size: 50px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.t3 { font-size: 15px; color: var(--ink-2); margin-top: 6px; }
.t3 b { color: var(--ink); }

/* hero */
.hero { display: grid; grid-template-columns: 1fr 1fr 1fr 1.7fr; gap: 26px; align-items: end; }
@media (max-width: 1200px) { .hero { grid-template-columns: 1fr 1fr 1fr; } .hero > :last-child { grid-column: 1 / -1; } }
.hero .lbl { font-weight: 700; color: var(--ink-2); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; }
.dot.done { background: var(--done); } .dot.wip { background: var(--wip); } .dot.ns { background: var(--ns); } .dot.none { background: var(--none); border: 1px solid #cbd5e1; }
.kpis3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.kpi-s { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: block; }
a.kpi-s:hover { border-color: #c7d2fe; background: #f8faff; }
.kpi-s .n { font-size: 22px; font-weight: 800; }
.kpi-s .p { font-size: 12.5px; color: var(--muted); }
.kpi-s .k { display: flex; align-items: center; gap: 6px; }
.insight { margin-top: 16px; display: flex; gap: 10px; align-items: flex-start; background: var(--wash); border: 1px solid #dbe4ff; border-radius: 12px; padding: 10px 14px; font-size: 13.5px; }
.insight b { color: #1e3a8a; }
.insight.warn { background: var(--amber-bg); border-color: #fde68a; }
.insight.warn b { color: #92400e; }

/* status bar */
.sbar { display: flex; gap: 2px; height: 14px; border-radius: 7px; overflow: hidden; background: #fff; }
.sbar > * { display: block; height: 100%; min-width: 0; }
.sbar .done { background: var(--done); } .sbar .wip { background: var(--wip); } .sbar .ns { background: var(--ns); }
.sbar a:hover { filter: brightness(1.12); }
.sbar.big { height: 30px; border-radius: 9px; }
.sbar.empty-bar { background: var(--none); }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12.5px; color: var(--ink-2); align-items: center; }
.legend > * { display: inline-flex; align-items: center; gap: 6px; }
.legend a:hover { color: var(--brand); text-decoration: underline; }

/* tables */
table.t { width: 100%; border-collapse: collapse; }
table.t th { text-align: left; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 700; padding: 0 10px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
table.t th button { font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; cursor: pointer; }
table.t th button:hover, table.t th.sorted button { color: var(--brand); }
table.t td { padding: 9px 10px; border-bottom: 1px solid #eef1f7; vertical-align: middle; }
table.t tr:last-child td { border-bottom: none; }
table.t .r { text-align: right; }
table.t td.name { font-weight: 700; white-space: nowrap; }
table.t td.name small { display: block; font-weight: 500; color: var(--muted); font-size: 11.5px; }
table.t td.name .nm { display: flex; align-items: center; gap: 10px; }
.lenbar { height: 10px; border-radius: 0 5px 5px 0; background: #c7d2fe; min-width: 2px; }
tr.other td.name { color: var(--muted); }
table.t.nav tr.go td { cursor: pointer; }
table.t.nav tr.go:hover td { background: #f3f6ff; }
table.t td.chev { color: var(--brand); font-size: 20px; font-weight: 700; text-align: right; width: 28px; line-height: 1; }
.foldrow td { text-align: center; }
.foldrow button { color: var(--brand); font-weight: 600; font-size: 12.5px; cursor: pointer; padding: 4px 10px; }

/* funnel */
.fun { display: grid; grid-template-columns: 120px 1fr 62px 58px 158px; gap: 6px 10px; align-items: center; }
.fun .lab { font-weight: 700; font-size: 13px; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.fun .bar { height: 22px; border-radius: 0 6px 6px 0; min-width: 3px; }
.fun .num { text-align: right; font-weight: 800; }
.fun .pct { text-align: right; color: var(--muted); font-size: 12.5px; }
.fun .conv { font-size: 12px; font-weight: 700; color: var(--ink-2); white-space: nowrap; justify-self: start; }
.fun .conv.worst { color: var(--amber); background: var(--amber-bg); border: 1px solid #fde68a; border-radius: 6px; padding: 1px 6px; }
.fun .conv.bad { color: #991b1b; background: var(--red-bg); border: 1px solid #fecaca; border-radius: 6px; padding: 1px 6px; }
.fun .hd { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 700; }

/* level chip */
.lvl { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 22px; padding: 0 7px; border-radius: 6px; font-size: 11.5px; font-weight: 800; white-space: nowrap; }

/* highest-level segmented bar */
.hbar { display: flex; gap: 2px; height: 34px; border-radius: 9px; overflow: hidden; }
.hbar > * { display: flex; align-items: center; padding: 0 10px; font-style: normal; font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; min-width: 4px; }
.hbar a:hover { filter: brightness(1.08); }
.hlist { display: grid; gap: 6px 14px; margin-top: 12px; }
.hlist > * { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 2px 4px; border-radius: 6px; }
.hlist a:hover { background: #f3f6ff; }
.hlist b { margin-left: auto; }

/* per-level status rows */
.lrows { display: grid; grid-template-columns: 46px 1fr 74px 74px 80px; gap: 8px 12px; align-items: center; font-size: 12.5px; }
.lrows .hd { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 700; text-align: right; }
.lrows .n { text-align: right; }
.lrows a.n:hover { text-decoration: underline; }
.lrows .n.done { color: var(--done); font-weight: 800; }
.lrows .n.wip { color: var(--wip); font-weight: 700; }

.empty { border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 16px 18px; background: #fafbfd; color: var(--ink-2); font-size: 13.5px; display: flex; gap: 12px; align-items: center; }
.empty b { color: var(--ink); }
.empty.big { flex-direction: column; text-align: center; padding: 48px 24px; }
.dq { border: 1px solid #fde68a; background: var(--amber-bg); border-radius: 14px; padding: 16px 20px; }
.dq li { margin: 4px 0 4px 18px; font-size: 13px; color: #78350f; list-style: disc; }
.dq li a { color: #92400e; font-weight: 700; text-decoration: underline; }
.dq .h2 { color: #92400e; }
.dq.ok { border-color: #bbf7d0; background: #f0fdf4; }
.dq.ok .h2 { color: #166534; }

.stepper { margin-left: auto; display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #fff; font-size: 13px; }
.stepper a, .stepper span { padding: 7px 12px; color: var(--brand); font-weight: 600; }
.stepper a:hover { background: #f3f6ff; }
.stepper span.dis { color: #b8c0d4; }
.stepper b { padding: 7px 12px; border-left: 1px solid var(--line); border-right: 1px solid var(--line); color: var(--ink-2); }
.cmp { display: inline-flex; gap: 6px; align-items: center; font-size: 12.5px; border-radius: 999px; padding: 4px 10px; border: 1px solid var(--line); background: #fff; }
.cmp .vs { color: var(--muted); }
.cmp.up { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
.cmp.down { border-color: #fecaca; background: var(--red-bg); color: #991b1b; }
.cmp.eq { color: var(--ink-2); }

/* status chip (per level, employee list) */
.st { display: inline-flex; align-items: center; justify-content: center; height: 22px; min-width: 26px; padding: 0 6px; border-radius: 6px; font-size: 11px; font-weight: 800; }
.st.done { background: var(--green-bg); color: #166534; border: 1px solid #bbf7d0; }
.st.wip { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.st.ns { background: #f8fafc; color: #64748b; border: 1px dashed #cbd5e1; }

/* ---------- controls ---------- */
.btn { height: 38px; padding: 0 16px; border-radius: 10px; border: none; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; transition: background 0.15s, box-shadow 0.15s, opacity 0.15s; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.btn.primary { background: var(--brand); color: #fff; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.25); }
.btn.primary:hover:not(:disabled) { background: var(--brand-600); }
.btn.ghost { background: #fff; color: var(--brand); border: 1px solid var(--line); }
.btn.ghost:hover:not(:disabled) { background: var(--wash); }
.btn.sm { height: 32px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
.btn:focus-visible, .btn-up:focus-visible, .chip:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

.chip { height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); background: #fff; display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-weight: 500; font-size: 13px; cursor: pointer; white-space: nowrap; }
.chip.on { background: var(--wash); border-color: #c7d2fe; color: var(--brand); }
.fchip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; padding: 4px 6px 4px 10px; border-radius: 999px; background: var(--wash); color: #1e3a8a; border: 1px solid #c7d2fe; }
.fchip button { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: #1e3a8a; }
.fchip button:hover { background: #c7d2fe; }
select.chip, select.sel { appearance: none; padding-right: 28px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5l3 3 3-3' fill='none' stroke='%236b7690' stroke-width='1.5'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
select.sel { height: 32px; border: 1px solid var(--line); border-radius: 8px; padding-left: 10px; background-color: #fff; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
select.sel.need { border-color: #fca5a5; background-color: var(--red-bg); color: #991b1b; }
.search { height: 38px; border: 1px solid var(--line); border-radius: 10px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: #fafbfd; }
.search input { border: none; outline: none; background: transparent; flex: 1; font-size: 13.5px; color: var(--ink); min-width: 0; }

.pill { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.pill.g { background: var(--green-bg); color: var(--done); }
.pill.r { background: var(--red-bg); color: var(--red); }
.pill.a { background: var(--amber-bg); color: var(--amber); }
.pill.i { background: var(--wash); color: var(--brand); }
.link { color: var(--brand); font-weight: 600; cursor: pointer; }
.link:hover { text-decoration: underline; }

table.data { width: 100%; border-collapse: collapse; }
table.data th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; padding: 11px 14px; background: #f8faff; border-bottom: 1px solid var(--line); white-space: nowrap; }
table.data th button { font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; cursor: pointer; }
table.data th.sorted button, table.data th button:hover { color: var(--brand); }
table.data td { padding: 9px 14px; border-bottom: 1px solid #eef1f7; font-size: 13px; vertical-align: middle; }
table.data tr:last-child td { border-bottom: none; }
table.data tbody tr:hover td { background: #fafbff; }
.pager button { min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--line); background: #fff; font-weight: 600; font-size: 13px; cursor: pointer; }
.pager button:disabled { opacity: 0.4; cursor: not-allowed; }

.banner-past { background: var(--amber-bg); border-bottom: 1px solid #fde68a; color: #78350f; }
.drop { border: 2px dashed #a5b4fc; border-radius: 14px; background: linear-gradient(180deg, #f8f9ff, #eef2ff); text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.drop.over { border-color: var(--brand); background: #e0e7ff; }
.popover { position: absolute; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 34px rgba(15, 27, 61, 0.18); z-index: 40; color: var(--ink); }
.decide { border: 1px solid #fde68a; background: var(--amber-bg); border-radius: 12px; }
.decide table td { border-bottom-color: #fdecc0; }

/* =================== Liquid cards (approved design: mockups/fde-cards/option-2-liquid) ===================
 * Golden-ratio system (φ = 1.618): type 13 · 16 · 20 · 26 · 33 · 42 · 53 · 68 · 86 px; space 8 · 13 · 21 · 34 · 55 px.
 * Numbers are semibold (600) Manrope; digits are equal-width only while counting up. */
:root { --s1: 8px; --s2: 13px; --s3: 21px; --s4: 34px; --s5: 55px; --trk: #e6ebf3;
  --shadow-soft: 0 1px 2px rgba(15, 27, 61, .05), 0 8px 24px rgba(15, 27, 61, .06);
  --ind: #4f46e5; --amb: #d97706; --amb-ink: #92400e; --amb-line: #fcd9a0; }
.sec { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: var(--s3) 0 calc(-1 * var(--s1)); }
.g4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s3); }
@media (max-width: 1100px) { .g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.bignum { display: block; font-weight: 600; letter-spacing: -.03em; line-height: 1; color: var(--ink); white-space: nowrap; font-variant-numeric: normal; }
.bignum.counting { font-variant-numeric: tabular-nums; }
.n86 { font-size: 86px; } .n68 { font-size: 68px; } .n53 { font-size: 53px; } .n42 { font-size: 42px; }
.lq-lab { display: flex; align-items: center; gap: var(--s1); font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); margin-bottom: var(--s2); }
.lq-lab .dot { width: 12px; height: 12px; border-radius: 4px; }
.lq-sub { font-size: 16px; color: var(--ink-2); margin-top: var(--s1); }
.lq-sub b { color: var(--ink); font-weight: 700; }

.lq { position: relative; overflow: hidden; display: block; background: var(--card); border-radius: var(--s3); box-shadow: var(--shadow-soft); min-height: 200px; text-align: left; width: 100%; }
a.lq:hover, button.lq:hover { box-shadow: 0 0 0 2px #c7d2fe, var(--shadow-soft); }
button.lq { cursor: pointer; font: inherit; color: inherit; } /* Data checks card opens its list */
.lq .in { position: relative; z-index: 2; padding: var(--s3) var(--s4); }
.lq.warn { background: #fff8eb; box-shadow: inset 0 0 0 1px var(--amb-line); }
.lq.warn .lq-lab, .lq.warn .lq-sub, .lq.warn .lq-sub b { color: var(--amb-ink); }
.lq.bad { background: #fef2f2; box-shadow: inset 0 0 0 1px #fecaca; }
.lq.bad .lq-lab, .lq.bad .lq-sub { color: #991b1b; }
.liq { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; }
.liq.done { background: #d5f3df; } .liq.wip { background: #d9e6fd; } .liq.ns { background: #e5e9f0; } .liq.ind { background: #e3e2fd; } .liq.amb { background: #fde7c2; }
.liq .wave { position: absolute; left: 0; top: -13px; width: 200%; height: 14px; }
.liq .wave.w2 { opacity: .55; top: -9px; }
.liq.done .wave path { fill: #d5f3df; } .liq.wip .wave path { fill: #d9e6fd; } .liq.ns .wave path { fill: #e5e9f0; } .liq.ind .wave path { fill: #e3e2fd; } .liq.amb .wave path { fill: #fde7c2; }
/* the wave only moves while pouring or on a short hover slosh; otherwise the page is still */
.lq .wave { animation: lq-wave 2.6s linear infinite paused; } .lq .wave.w2 { animation-duration: 3.8s; animation-direction: reverse; }
.lq.moving .wave { animation-play-state: running; } /* pours on load, waves while hovered, freezes in place when left */
@keyframes lq-wave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.lq:has(.tubes) .in { padding-right: 104px; } /* room for the 3 tubes */
.tubes { position: absolute; right: var(--s4); top: var(--s3); bottom: var(--s3); display: flex; gap: var(--s1); z-index: 2; }
.tube { width: 16px; border-radius: 9px; background: var(--trk); position: relative; overflow: hidden; }
.tube i { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 9px; }
.tube i.done { background: var(--done); } .tube i.wip { background: var(--wip); } .tube i.ns { background: var(--ns); }
.cmpb { display: inline-flex; align-items: center; gap: 4px; margin-top: var(--s2); font-size: 13px; font-weight: 700; border-radius: 999px; padding: 3px 10px; }
.cmpb.up { background: #dcfce7; color: #166534; } .cmpb.down { background: #fee2e2; color: #991b1b; } .cmpb.eq { background: #eef1f6; color: var(--ink-2); }

/* HyperScaler square cards with big logos */
.hsq { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: var(--s3); }
@media (max-width: 1100px) { .hsq { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sq { background: var(--card); border-radius: var(--s3); box-shadow: var(--shadow-soft); padding: var(--s3) var(--s4); display: flex; flex-direction: column; gap: var(--s2); border: 1px solid transparent; transition: border-color .2s, box-shadow .2s, transform .2s; }
a.sq:hover { border-color: #a5b4fc; box-shadow: 0 13px 34px rgba(29, 78, 216, .14); transform: translateY(-2px); }
.hs-logo { width: 76px; height: 76px; border-radius: var(--s3); display: grid; place-items: center; background: color-mix(in srgb, var(--b) 9%, #fff); border: 1px solid color-mix(in srgb, var(--b) 18%, #fff); flex: none; }
.hs-logo svg { width: 47px; height: 47px; fill: var(--b); }
.hs-logo .mono { font-size: 26px; font-weight: 700; color: var(--b); letter-spacing: -.02em; }
.hs-logo.sm { width: 44px; height: 44px; border-radius: var(--s2); } .hs-logo.sm svg { width: 26px; height: 26px; } .hs-logo.sm .mono { font-size: 15px; }
.sq .nm { font-size: 20px; font-weight: 700; margin-top: var(--s1); line-height: 1.236; }
.sq .ct { display: flex; align-items: baseline; gap: var(--s1); }
.sq .ct small { font-size: 16px; color: var(--muted); font-weight: 500; }
.sq .sbar { height: 8px; }
.sq .dn { font-size: 16px; font-weight: 700; color: var(--done); }
.sq .dn.z { color: var(--muted); font-weight: 500; }
.sq .go { margin-top: auto; font-weight: 700; color: var(--brand); font-size: 16px; padding-top: var(--s2); border-top: 1px solid var(--line); }
.sq.empty { background: #f7f9fc; box-shadow: none; border: 1.5px dashed #cdd5e3; }
.sq.empty .hs-logo { filter: grayscale(1); opacity: .55; }
.sq.empty .bignum { color: #8a94ab; }
.sq.empty .sbar { background: repeating-linear-gradient(45deg, #e6ebf3 0 6px, #f1f4f9 6px 12px); }
.tag-nod { font-size: 11.5px; font-weight: 700; color: #56617d; background: #eef1f6; border: 1px solid #dfe5f0; border-radius: 6px; padding: 1px 6px; margin-left: 6px; vertical-align: 3px; }

@media (prefers-reduced-motion: reduce) { .lq .wave, .g-wave, .tank .edge svg { animation: none; } a.sq:hover { transform: none; } }

/* =================== Fluid system: lower sections + all pages =================== */
.fl-card { background: var(--card); border-radius: var(--s3); box-shadow: var(--shadow-soft); padding: var(--s3) var(--s4) var(--s4); min-width: 0; }
.fl-head { display: flex; align-items: center; gap: var(--s1); margin-bottom: var(--s3); flex-wrap: wrap; }
.fl-head h3 { font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
.fl-i { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #c3cad9; color: #7d879d; font-size: 11px; font-weight: 700; display: inline-grid; place-items: center; cursor: help; }
.fl-legend { display: flex; gap: var(--s3); font-size: 14px; color: var(--ink-2); margin: calc(-1 * var(--s1)) 0 var(--s3); }
.fl-legend span { display: inline-flex; align-items: center; gap: 6px; }
.fl-note { font-size: 15px; color: var(--ink-2); margin-bottom: var(--s2); }
.n33 { font-size: 33px; } .n26 { font-size: 26px; }

/* tank + pour (horizontal liquid) */
.tank { position: relative; border-radius: var(--s1); background: var(--trk); overflow: hidden; width: 100%; }
.pour { position: absolute; inset: 0; display: flex; gap: 2px; }
.pour .seg { position: relative; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; font-weight: 700; min-width: 0; overflow: hidden; white-space: nowrap; }
.pour a.seg:hover { filter: brightness(1.1); }
.pour .seg.done { background: var(--done); } .pour .seg.wip { background: var(--wip); } .pour .seg.ns { background: #cbd5e1; color: #334155; }
.pour::after { content: ''; position: absolute; inset: 0 0 61.8% 0; background: linear-gradient(rgba(255,255,255,.24), rgba(255,255,255,0)); pointer-events: none; }
.tank .edge { position: absolute; top: -6px; bottom: -6px; width: 21px; margin-left: -10px; opacity: 0; transition: opacity .5s; pointer-events: none; }
.tank .edge path { fill: rgba(255,255,255,.55); }
.tank .edge svg { width: 100%; height: 200%; animation: fl-ripple .7s linear infinite; }
.tank.pouring .edge { opacity: 1; }
@keyframes fl-ripple { from { transform: translateY(-50%); } to { transform: translateY(0); } }
.two { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; padding: 0 var(--s2); width: 100%; }
.two b { font-size: 18px; font-weight: 700; } .two small { font-size: 12px; font-weight: 700; opacity: .85; }

/* status per level */
.fl-levels { display: grid; gap: var(--s2); }
.fl-lvrow { display: grid; grid-template-columns: 44px 1fr 84px; gap: var(--s2); align-items: center; }
.fl-lvrow .lvl { height: 30px; font-size: 13px; }
.fl-done { text-align: right; font-size: 16px; font-weight: 700; color: var(--done); }
.fl-done:hover { text-decoration: underline; }

/* funnel glasses */
.glasses { display: flex; align-items: flex-start; gap: var(--s1); }
.g-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s1); padding: var(--s1); border-radius: var(--s2); }
a.g-col:hover { background: #f3f6ff; }
.g-lab { font-size: 14px; font-weight: 700; color: var(--ink-2); display: flex; align-items: center; gap: 4px; height: 26px; }
.glass { position: relative; width: 100%; max-width: 89px; height: 144px; border-radius: 6px 6px var(--s2) var(--s2); border: 2px solid #d3dbe8; border-top-color: #e7ecf4; background: #f7f9fc; overflow: hidden; }
.g-liq { position: absolute; left: 0; right: 0; bottom: 0; }
.g-wave { position: absolute; left: 0; top: -9px; width: 200%; height: 10px; }
.g-wave { animation: lq-wave 1.6s linear infinite paused; }
.glass.pouring .g-wave, .g-col:hover .g-wave, .g-col:focus-visible .g-wave { animation-play-state: running; }
.g-sub { font-size: 13px; color: var(--muted); margin-top: -4px; }
.g-pill { flex: none; align-self: center; margin-top: -30px; display: flex; flex-direction: column; align-items: center; font-size: 14px; font-weight: 800; color: var(--ink-2); background: #eef2ff; border-radius: var(--s2); padding: 6px 8px; white-space: nowrap; }
.g-pill small { font-size: 11px; font-weight: 700; }
.g-pill.worst { color: #92400e; background: #fef3c7; box-shadow: inset 0 0 0 1px var(--amb-line); }
.g-pill.over { color: #991b1b; background: #fee2e2; }

/* highest level legend */
.fl-keys { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s3); margin-top: var(--s3); }
.fl-key { display: inline-flex; align-items: center; gap: var(--s1); font-size: 14px; color: var(--ink-2); padding: 4px 8px; border-radius: var(--s1); }
.fl-key:hover { background: #f3f6ff; }
.fl-key i { width: 12px; height: 12px; border-radius: 4px; border: 1px solid rgba(15,27,61,.08); }
.fl-key b { color: var(--ink); font-weight: 700; } .fl-key span { color: var(--muted); }

/* breakdown */
.fl-ctrls { margin-left: auto; display: flex; align-items: center; gap: var(--s2); }
.seg-tg { display: inline-flex; background: #f1f4fa; border-radius: 10px; padding: 3px; }
.seg-tg button { padding: 7px 14px; border-radius: 8px; font-size: 14px; font-weight: 700; color: var(--muted); cursor: pointer; }
.seg-tg button.on { background: #fff; color: var(--brand); box-shadow: 0 1px 3px rgba(15,27,61,.12); }
.fl-sort { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
.bd-rows { display: grid; }
.bd-row { display: grid; grid-template-columns: minmax(180px, 1.2fr) 70px minmax(0, 2.618fr) 110px 64px 20px; gap: var(--s2) var(--s3); align-items: center; padding: var(--s2) var(--s1); border-bottom: 1px solid #eef1f7; border-radius: var(--s1); }
.bd-row:last-child { border-bottom: none; }
.bd-row:hover { background: #f3f6ff; }
.bd-name { font-size: 16px; font-weight: 700; } .bd-name small { display: block; font-size: 13px; font-weight: 500; color: var(--muted); }
.bd-row.other .bd-name { color: var(--muted); }
.bd-row .bignum { text-align: right; }
.bd-bar { display: block; }
.bd-st { font-size: 14px; color: var(--ink-2); text-align: right; }
.bd-dn { font-size: 15px; font-weight: 700; color: var(--done); text-align: right; } .bd-dn.z { color: #a3acc2; font-weight: 500; }
.bd-chev { color: var(--brand); font-size: 22px; font-weight: 700; }
.bd-more { display: block; margin: var(--s2) auto 0; color: var(--brand); font-weight: 700; font-size: 14px; cursor: pointer; padding: 6px 12px; border-radius: var(--s1); }
.bd-more:hover { background: #f3f6ff; }
@media (max-width: 1100px) { .bd-row { grid-template-columns: 1fr 60px 1fr 20px; } .bd-st, .bd-dn { display: none; } .glasses { flex-wrap: wrap; } }

/* compact liquid cards */
.lq.sm { min-height: 144px; }
.lq.sm .in { padding: var(--s3) var(--s3) var(--s3) var(--s4); }

/* page-level polish for every page */
.vhead h2 { font-size: 33px; font-weight: 700; letter-spacing: -.015em; }
.vhead .meta { font-size: 14px; }
h1.title { font-size: 33px; font-weight: 700; letter-spacing: -.015em; }
.card, .panel { border-radius: var(--s3); box-shadow: var(--shadow-soft); border-color: transparent; }
.panel table.data th:first-child, .panel table.data td:first-child { padding-left: var(--s4); }
table.data th { font-size: 12px; padding: var(--s2) var(--s2); }
table.data td { font-size: 14px; padding: 11px var(--s2); }
.drop { border-radius: var(--s3); background: linear-gradient(180deg, #f8faff 0%, #eef2ff 61.8%, #e3e9ff 100%); }
.decide { border-radius: var(--s3); }
.empty.big { border-radius: var(--s3); }
.subtabs a { display: inline-flex; align-items: center; gap: 6px; }
.subtabs .hs-logo { width: 22px; height: 22px; border-radius: 6px; } .subtabs .hs-logo svg { width: 13px; height: 13px; } .subtabs .hs-logo .mono { font-size: 9px; }

/* =================== HyperScaler vs status: never look alike =================== */
/* Heading: HyperScaler with its logo (neutral ink) · status as a solid status-coloured badge that pops when it changes */
.ph-title { display: flex; align-items: center; gap: var(--s2); flex-wrap: wrap; }
.ph-context { font-size: 15px; color: var(--ink-2); margin-top: 4px; }
.st-badge { display: inline-flex; align-items: center; gap: var(--s1); height: 38px; padding: 0 var(--s3) 0 var(--s2); border-radius: 999px; font-size: 17px; font-weight: 700; color: #fff; box-shadow: 0 4px 13px -4px var(--sc); animation: st-pop .55s cubic-bezier(.2, 1.6, .4, 1) both; }
.st-badge i { width: 13px; height: 13px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.35); }
.st-badge.done { --sc: #15803d; background: #15803d; } /* darker green: white text needs 4.5:1 */ .st-badge.wip { --sc: var(--wip); background: var(--wip); } .st-badge.ns { --sc: #64748b; background: #64748b; }
@keyframes st-pop { 0% { transform: scale(.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

/* Status cards on the Employees page: the active filter is ringed in its colour, the others step back */
.lq.selected.done { --ring: #15803d; } .lq.selected.wip { --ring: var(--wip); } .lq.selected.ns { --ring: #64748b; }
.lq.selected, a.lq.selected:hover { box-shadow: 0 0 0 3px var(--ring), 0 13px 34px -13px var(--ring); } /* ring stays while hovered */
.lq.dim { opacity: .5; filter: saturate(.6); transition: opacity .2s, filter .2s; }
.lq.dim:hover { opacity: 1; filter: none; }
.lq-corner { position: absolute; top: var(--s2); right: var(--s2); z-index: 3; font-size: 12px; font-weight: 700; color: #fff; background: var(--ring, var(--brand)); border-radius: 999px; padding: 3px 10px; }

/* Filter chips: status chip in its colour with a dot; HyperScaler chip with its logo; others stay neutral indigo */
.fchip.st-chip.done { background: #ecfdf3; color: #166534; border-color: #86efac; }
.fchip.st-chip.wip { background: #eff6ff; color: #1d4ed8; border-color: #93c5fd; }
.fchip.st-chip.ns { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
.fchip.st-chip .dot { width: 10px; height: 10px; border-radius: 50%; }
.fchip.hs-chip { background: #fff; color: var(--ink); border-color: var(--line); }
.fchip .hs-logo { width: 20px; height: 20px; border-radius: 6px; } .fchip .hs-logo svg { width: 12px; height: 12px; } .fchip .hs-logo .mono { font-size: 8px; }
.ph-title .hs-logo { width: 44px; height: 44px; }
/* Status dropdown takes the colour of the chosen status */
select.sel.st-sel.done { border-color: #86efac; background-color: #ecfdf3; color: #166534; }
select.sel.st-sel.wip { border-color: #93c5fd; background-color: #eff6ff; color: #1d4ed8; }
select.sel.st-sel.ns { border-color: #cbd5e1; background-color: #f1f5f9; color: #334155; }
@media (prefers-reduced-motion: reduce) { .st-badge { animation: none; } }
```

## Appendix B: src/app/lib/logos.ts

`apps/web-ng/src/app/lib/logos.ts`

```ts
/**
 * Brand icons from Simple Icons v13.0.0 (CC0). Trademarks belong to their owners.
 * Azure is not in Simple Icons, so it uses a lettered tile in Azure blue.
 */
export interface Logo { paths: string[]; color: string }

export const HS_LOGOS: Record<string, Logo> = {
  "Anthropic": { color: "#191919", paths: ["M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"] },
  "AWS": { color: "#232F3E", paths: ["M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z"] },
  "Google": { color: "#4285F4", paths: ["M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z"] },
  "GitHub": { color: "#181717", paths: ["M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"] },
  "Red Hat OpenShift": { color: "#EE0000", paths: ["M21.665,11.812c-0.11-1.377-0.476-2.724-1.08-3.966L24,6.599c-0.268-0.556-0.585-1.092-0.943-1.595 l-1.601,0.583c-3.534-4.95-10.412-6.098-15.363-2.565c-3.144,2.244-4.883,5.972-4.582,9.823l1.604-0.584 c0.051,0.615,0.153,1.224,0.305,1.822L0,15.335c0.338,1.339,0.922,2.604,1.721,3.731l1.812-0.659 c3.526,4.95,10.398,6.106,15.349,2.58c1.555-1.107,2.796-2.6,3.599-4.332c0.802-1.715,1.144-3.61,0.991-5.497L21.665,11.812z M16.925,9.177c0.687,1.227,0.998,2.629,0.895,4.032l1.809-0.657c-0.063,0.856-0.282,1.694-0.646,2.471 c-1.67,3.584-5.928,5.138-9.514,3.472c-0.782-0.365-1.491-0.87-2.092-1.49l-1.813,0.66c-0.979-1.01-1.64-2.285-1.903-3.667 l3.426-1.242c-0.121-0.624-0.159-1.262-0.111-1.896H6.97l-1.604,0.583c0.294-3.932,3.72-6.881,7.652-6.587 c0.868,0.065,1.716,0.288,2.504,0.658V5.508c0.778,0.364,1.483,0.867,2.082,1.483l1.599-0.582c0.002,0.002,0.004,0.003,0.006,0.005 c0.441,0.454,0.82,0.965,1.128,1.518L16.925,9.177z"] },
  "Red Hat Ansible Automation": { color: "#EE0000", paths: ["M10.617 11.473l4.686 3.695-3.102-7.662zM12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.797 17.305c-.011.471-.403.842-.875.83-.236 0-.416-.09-.664-.293l-6.19-5-2.079 5.203H6.191L11.438 5.44c.124-.314.427-.52.764-.506.326-.014.63.189.742.506l4.774 11.494c.045.111.08.234.08.348-.001.009-.001.009-.001.023z"] },
};

/** Lettered tiles for HyperScalers without an icon. */
export const HS_TILES: Record<string, { text: string; color: string }> = { Azure: { text: 'Az', color: '#0078D4' } };
```

## Appendix C: IconComponent (in src/app/ui/basics.ts)

```ts
/* ---------------- icons ---------------- */

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    @switch (name) {
      @case ('upload') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>
      }
      @case ('search') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      }
      @case ('history') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></svg>
      }
      @case ('download') {
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>
      }
      @case ('file') {
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>
      }
    }
  `,
  host: { style: 'display:contents' },
})
```

## Appendix D: src/app/lib/levels.ts

`apps/web-ng/src/app/lib/levels.ts`

```ts
/**
 * Level colours for ANY number of levels (N comes from the data).
 * One indigo hue in OKLCH; lightness spread evenly from light (L1) to dark (top level).
 * Same algorithm as mockups/fde-redesign/ramp.js (validated with the dataviz ordinal checker for N = 3…9).
 */
export interface LevelColor {
  level: number;
  hex: string;
  /** Text colour on the fill. */
  ink: string;
}

const HUE = 277;
const L_LIGHT = 0.74;
const L_DARK = 0.24;

function oklchToRgb(L: number, C: number, hDeg: number): number[] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const lum = (rgb: number[]) => {
  const c = rgb.map((v) => clamp(v)).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const cache = new Map<number, LevelColor[]>();

/** Colours for levels 1..n, light → dark. */
export function levelRamp(n: number): LevelColor[] {
  const hit = cache.get(n);
  if (hit) return hit;
  const out: LevelColor[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const L = L_LIGHT + (L_DARK - L_LIGHT) * t;
    let C = 0.11 + 0.09 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    let rgb = oklchToRgb(L, C, HUE);
    while (!inGamut(rgb) && C > 0.01) rgb = oklchToRgb(L, (C -= 0.005), HUE);
    const Y = lum(rgb);
    const cWhite = 1.05 / (Y + 0.05);
    const cInk = (Y + 0.05) / (0.0157 + 0.05);
    out.push({ level: i + 1, hex: toHex(rgb), ink: cWhite >= cInk ? '#FFFFFF' : '#1E1B4B' });
  }
  cache.set(n, out);
  return out;
}
```

## Appendix E1: src/assets/brand/logo.svg

`apps/web-ng/src/assets/brand/logo.svg`

```svg
<!-- PLACEHOLDER wordmark. Replace this file with the startup's real logo (SVG preferred), keeping the file name,
     or point BRAND.logo in src/lib/brand.ts to the new file. -->
<svg xmlns="http://www.w3.org/2000/svg" width="340" height="60" viewBox="0 0 340 60">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
  <rect x="4" y="10" width="26" height="26" rx="8" fill="url(#g)"/>
  <rect x="18" y="24" width="26" height="26" rx="8" fill="url(#g)" opacity=".75"/>
  <text x="58" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="800" fill="#0f1b3d" letter-spacing="-0.5">YOUR COMPANY</text>
  <text x="58" y="51" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#5b6680" letter-spacing="2.4">TECHNOLOGIES PRIVATE LIMITED</text>
</svg>
```

## Appendix E2: src/favicon.svg

`apps/web-ng/src/favicon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#4F46E5"/><path d="M16 5l3.6 7.2 7.9 1.1-5.7 5.6 1.3 7.9L16 23.1l-7.1 3.7 1.3-7.9-5.7-5.6 7.9-1.1z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>
```

## Appendix F: apps/api/server.mjs

`apps/api/server.mjs`

```js
/**
 * Local API for the AI Academy FDE Dashboard (Angular app in ../web-ng).
 * Stores each monthly upload as a CSV snapshot in ./local-data (or $LOCAL_DATA_DIR). No dependencies.
 *
 *   GET  /api/snapshots          → JSON list of snapshots, newest first
 *   GET  /api/snapshots/latest   → CSV text of the newest snapshot (204 if none; X-Snapshot-Name header)
 *   GET  /api/snapshots/:name    → CSV text of one snapshot
 *   POST /api/snapshots          → { name, content } writes a new snapshot (never overwrites)
 *   GET  /api/mappings           → JSON of the uploader's remembered value choices (204 if none)
 *   PUT  /api/mappings           → replaces local-data/mappings.json
 *
 * File names: {latest sheet date ddmmyy}-{upload date ddmmyy}-{upload time hhmmss}.csv
 * Usage: node server.mjs   (PORT, default 9010; LOCAL_DATA_DIR, default ./local-data)
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 9010);
const DATA_DIR = path.resolve(process.env.LOCAL_DATA_DIR ?? path.join(HERE, 'local-data'));
const NAME_RE = /^(\d{6})-(\d{6})-(\d{6})\.csv$/;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

/** Sort key from the upload-date and upload-time parts: yymmddhhmmss. */
function uploadSortKey(name) {
  const m = NAME_RE.exec(name);
  if (!m) return '';
  const d = m[2];
  return d.slice(4, 6) + d.slice(2, 4) + d.slice(0, 2) + m[3];
}

function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function listSnapshots() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const out = [];
  for (const name of await fs.readdir(DATA_DIR)) {
    const m = NAME_RE.exec(name);
    if (!m) continue;
    const stat = await fs.stat(path.join(DATA_DIR, name));
    out.push({ name, dataUpTo: m[1], uploadedOn: m[2], uploadedAt: m[3], sizeBytes: stat.size });
  }
  return out.sort((a, b) => uploadSortKey(b.name).localeCompare(uploadSortKey(a.name)));
}

/** Write via a temp file + rename so a crash never leaves a half-written file. */
async function atomicWrite(file, text) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}

async function snapshots(req, res, rest) {
  if (req.method === 'GET' && rest === '') return json(res, 200, await listSnapshots());
  if (req.method === 'GET') {
    let name = decodeURIComponent(rest);
    if (name === 'latest') {
      const list = await listSnapshots();
      if (!list.length) return send(res, 204, '', 'text/csv');
      name = list[0].name;
    }
    if (!NAME_RE.test(name)) return json(res, 400, { error: 'Invalid snapshot name' });
    try {
      const csv = await fs.readFile(path.join(DATA_DIR, name), 'utf8');
      res.setHeader('X-Snapshot-Name', name);
      return send(res, 200, csv, 'text/csv');
    } catch {
      return json(res, 404, { error: 'Snapshot not found' });
    }
  }
  if (req.method === 'POST' && rest === '') {
    const body = JSON.parse(await readBody(req));
    if (typeof body.name !== 'string' || !NAME_RE.test(body.name)) return json(res, 400, { error: 'Invalid snapshot name' });
    if (typeof body.content !== 'string') return json(res, 400, { error: 'Missing content' });
    const target = path.join(DATA_DIR, body.name);
    try {
      await fs.access(target);
      return json(res, 409, { error: 'Snapshot already exists' }); // history is never overwritten
    } catch {
      /* does not exist yet: good */
    }
    await atomicWrite(target, body.content);
    return json(res, 201, { name: body.name });
  }
  return json(res, 405, { error: 'Method not allowed' });
}

async function mappings(req, res) {
  const file = path.join(DATA_DIR, 'mappings.json');
  if (req.method === 'GET') {
    try {
      return send(res, 200, await fs.readFile(file, 'utf8'));
    } catch {
      return send(res, 204, '');
    }
  }
  if (req.method === 'PUT') {
    const parsed = JSON.parse(await readBody(req));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json(res, 400, { error: 'Expected a JSON object' });
    await atomicWrite(file, JSON.stringify(parsed, null, 2));
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'Method not allowed' });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0].replace(/\/+$/, '');
  try {
    if (url === '/api/snapshots' || url.startsWith('/api/snapshots/')) return await snapshots(req, res, url.slice('/api/snapshots'.length).replace(/^\//, ''));
    if (url === '/api/mappings') return await mappings(req, res);
    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    return json(res, err instanceof SyntaxError ? 400 : 500, { error: err instanceof Error ? err.message : 'Server error' });
  }
});

server.listen(PORT, () => console.log(`FDE API on http://localhost:${PORT} · data in ${DATA_DIR}`));
```

## Appendix G: scripts/make-fde-sample.mjs

`apps/web-ng/scripts/make-fde-sample.mjs`

```js
// Builds local-data/test/fde-sample-nov-2026.xlsx (or the path given as the first argument): one month of user-wise data in the agreed format.
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

const OUT = path.resolve(process.argv[2] ?? 'local-data/test/fde-sample-nov-2026.xlsx');
const HEAD = ['Emp ID', 'Name', 'Reporting Orgn', 'Band', 'HyperScaler', 'ETA (Date)', 'Certificate done/WIP', 'Certification Levels', 'Email ID'];

let seed = 20261118;
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
    let date = day(2026, 1 + Math.floor(rnd() * 5), 1 + Math.floor(rnd() * 27));
    for (let lv = 1; lv <= Math.max(1, Math.min(4, lastRow)); lv++) {
      const lvText = pick(LEVEL_TEXT[lv - 1]);
      const asSerial = rnd() < 0.25; // some ETAs are real Excel dates
      if (lv <= highest) {
        date = addDays(date, 20 + Math.floor(rnd() * 40));
        if (date > day(2026, 11, 17)) date = day(2026, 11, 2 + lv);
        add(emp, hsText, asSerial ? serial(date) : longDate(date), pick(DONE_TEXT), lvText, { etaSerial: asSerial });
      } else if (lv === highest + 1 && startedNext) {
        const eta = day(2026, 12, 1 + Math.floor(rnd() * 27));
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
add(e1, 'AWS', longDate(day(2026, 10, 5)), 'Certified', 'L1');
add(e1, 'AWS', longDate(day(2026, 11, 2)), 'Certified', 'L2');
const e2 = edge(2);
add(e2, 'Google', longDate(day(2026, 9, 9)), 'Completed', 'Foundation');
const e3 = edge(3);
add(e3, 'Oracle Cloud', longDate(day(2026, 8, 12)), 'Completed', 'L1');
add(e3, 'Oracle Cloud', longDate(day(2026, 12, 20)), 'WIP', 'L2');
add(e3, 'Oracle Cloud', '', '', 'L3');
const e4 = edge(4);
add(e4, 'Azure', longDate(day(2026, 10, 1)), 'WIP', 'L1');
add(e4, 'Azure', longDate(day(2026, 10, 30)), 'Completed', 'L1');
const e5 = edge(5);
add(e5, 'Anthropic', longDate(day(2026, 12, 15)), 'In progress', 'L1');
add(e5, 'Anthropic', longDate(day(2026, 10, 20)), 'Completed', 'L2');
const e6 = edge(6);
add(e6, 'AWS', longDate(day(2026, 11, 10)), 'Completed', '');
rows.push([['', 'No Id Person', 'Consulting', 'B2', 'AWS', '', 'WIP', 'L1', 'no.id@example.com'], {}]);
const e7 = edge(7);
add(e7, 'Claude', longDate(day(2026, 7, 7)), 'Completed', 'L1');
const e8 = edge(8);
add(e8, 'Google', longDate(day(2027, 1, 20)), 0.6, 'L1', { pct: true });

// ---- write ----
const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows.map(([c]) => c)]);
rows.forEach(([, o], i) => {
  const r = i + 1;
  if (o.etaSerial) ws[XLSX.utils.encode_cell({ r, c: 5 })].z = 'dddd, mmmm dd, yyyy';
  if (o.pct) ws[XLSX.utils.encode_cell({ r, c: 6 })].z = '0%';
});
ws['!cols'] = [10, 20, 24, 6, 16, 30, 20, 18, 34].map((wch) => ({ wch }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Nov 2026');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(`Wrote ${OUT}: ${rows.length} rows`);
```
