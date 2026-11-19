# AI Academy FDE Dashboard

React + TypeScript frontend. There's no backend yet: a small Vite dev-server plugin saves each monthly upload as a CSV snapshot in `local-data/`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Upload the monthly sheet (.xlsx, .xls, .xlsb, .ods, .csv, .tsv) with the **Upload** button.

## Sheet format

One row per **employee × HyperScaler × level**. The columns, in this order:

| # | Column | Required |
|---|---|---|
| 1 | Emp ID | yes |
| 2 | Name | yes |
| 3 | Reporting Orgn | |
| 4 | Band | |
| 5 | HyperScaler | yes |
| 6 | ETA (Date) | |
| 7 | Certificate done/WIP | yes |
| 8 | Certification Levels | yes |
| 9 | Email ID | |

## Rules

### HyperScaler

| In the file | Stored as |
|---|---|
| Anthropic, Claude, Anthropic Claude | Anthropic |
| Azure, MS Azure, Microsoft Azure, Microsoft | Azure |
| AWS | AWS |
| Google | Google |

Matching ignores case, spaces and punctuation. Any other name is **added automatically** and flagged on the upload screen. There, the uploader can keep it as a new HyperScaler or say it is the same as an existing one.

### Status (Certificate done/WIP)

| In the file | Status |
|---|---|
| Empty | Not started |
| WIP, In progress, or a percentage | In progress |
| Completed, YES, Done | Completed |
| Anything else | The uploader decides |

### Certification Levels

- `L1`, `Level 1`, `Level-2`, `Level_3`, `level 4` (and L5 and above) are read as levels.
- Anything else: the uploader decides.

### Remembered choices

The uploader's decisions are saved in `local-data/mappings.json` and applied automatically to later uploads.

### ETA (Date)

- The date an employee completed, or expects to complete, that level.
- It is read from text such as "Wednesday, November 18, 2026", from real Excel dates, and from day-first dates.
- An unreadable ETA is left empty, with a warning.

## How the numbers are built

- An **enrollment** is one employee on one HyperScaler. **Employees** are counted once each.
- **Levels:**
  - N = the highest level in the file.
  - A level with no row counts as **Not started**, so every level has the same total.
- **Enrollment status:**
  - Completed = the top level (LN) is completed.
  - In progress = any level is started.
  - Otherwise Not started.
- **Highest level** = the highest level completed.
- **Duplicate rows** (same employee × HyperScaler × level): the furthest status is kept, and the duplicate is flagged.
- **Data checks** (flag only, nothing is changed):
  - a level completed while a lower one isn't;
  - completed counts going up from one level to the next (L1 ≥ L2 ≥ … is expected);
  - empty level cells;
  - conflicting Name, Org, Band or Email values for the same Emp ID;
  - a missing Org, Band or Email;
  - HyperScalers that were added from a file.

## Months and history

- **Each file is one month's data.** The data month is the month of the upload; earlier months are not merged into it.
- Each upload is saved as its own file:

  ```
  local-data/{latest completion date in the sheet ddmmyy}-{upload date ddmmyy}-{upload time hhmmss}.csv
  ```

  The file holds the 9 columns with the values already normalized.
- To see an earlier month (read-only), use **Month ▾** in the header or **Uploads → View this data**.
- Snapshots in an earlier format are kept in `local-data/archive-old-format/` and are not loaded.

## Views

| Route | Contents |
|---|---|
| `/` | Overall: hero, status per level, level funnel, highest level, data checks, and tables by HyperScaler, Reporting Orgn and Band |
| `/hs/:name` | One HyperScaler: breadcrumb, Prev/Next, comparison with Overall, the same cards, and its employees |
| `/people?hs=&org=&band=&st=&lv=&ls=&hi=&flag=` | The employee list (Emp ID, Name, Email ID, Org, Band, HyperScaler, status per level, ETA), with filters, search and Export CSV |
| `/upload`, `/uploads`, `/uploads/:id` | Upload with the decision step, upload history, and import summary |

Navigation rule: a row with **›** opens a view, and the whole row is clickable.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit and pipeline tests (Vitest) |
| `npm run typecheck` / `npm run build` | TypeScript check / production build |
| `npm run sample` | Writes `local-data/test/fde-sample-nov-2026.xlsx`: 446 rows in the exact format, including every edge case (see the header of `scripts/make-fde-sample.mjs`) |
| `node scripts/e2e.mjs <dir>` | Browser end-to-end test using the installed Edge. Run it against a dev server started with `LOCAL_DATA_DIR=.e2e-data` on port 5174, so real data isn't touched (see the header of the script). |

## Code map

- `vite-plugin-local-data.ts`: the `/api/snapshots` and `/api/mappings` endpoints. A future backend should implement these same endpoints.
- `src/lib/`:
  - `rules.ts`, `hyperscalers.ts`: the status, level and HyperScaler rules.
  - `parse.ts`, `columns.ts`, `validate.ts`: reading and checking a sheet.
  - `mappings.ts`: the remembered choices.
  - `aggregate.ts`: enrollments, per-level status, groups, filters and data checks.
  - `levels.ts`: level colours generated for any number of levels.
  - `csv.ts`: the snapshot format.
- `src/components/fde.tsx`: the design-system components (hero, status bars, funnel, ranked tables, breadcrumb, stepper, compare chips, data checks).
- `mockups/fde-redesign/`: the approved design.
