import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CleanRow, Field, St } from '../types';
import { STATUS_LABEL } from '../types';
import { ACCEPTED_EXTENSIONS, defaultSheetIndex, readWorkbook, type ParsedWorkbook } from '../lib/parse';
import { autoMapColumns, FIELDS, missingRequired, type ColumnMapping } from '../lib/columns';
import { validateRows, type NewHyperscaler, type UnknownValue } from '../lib/validate';
import { emptyMappings, fetchMappings, saveMappings, type Mappings } from '../lib/mappings';
import { KNOWN_HYPERSCALERS } from '../lib/hyperscalers';
import { runImport } from '../lib/runImport';
import { buildSnapshotId } from '../lib/snapshotName';
import { fmtIso, fmtNum, monthOf } from '../lib/format';
import { DataService } from '../core/data.service';
import { BreadcrumbComponent, IconComponent } from '../ui/basics';
import type { ImportNavState } from './uploads';

interface Loaded {
  file: File;
  wb: ParsedWorkbook;
  sheetIdx: number;
  mapping: ColumnMapping;
}

const merge = (a: Mappings, b: Mappings): Mappings => ({
  status: { ...a.status, ...b.status },
  level: { ...a.level, ...b.level },
  hyperscaler: { ...a.hyperscaler, ...b.hyperscaler },
});

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [BreadcrumbComponent, IconComponent],
  template: `
    <app-breadcrumb [parts]="crumbs" />
    <div class="page">
      <h1 class="title">Upload this month's sheet</h1>
      <div class="sub mt-1">
        One row per employee × HyperScaler × level. The file is saved as <b>{{ thisMonth }}</b> data (the upload month) in <code>local-data/</code>; earlier months stay available in the history.
      </div>

      @if (data.isPast()) {
        <div class="banner-past rounded-xl mt-4 px-4 py-3">You're viewing past data. Go back to the latest data to upload.</div>
      }

      <div
        class="drop mt-5 px-8"
        [class.py-6]="!!loaded()"
        [class.py-10]="!loaded()"
        [class.over]="over()"
        (click)="input.click()"
        (dragover)="$event.preventDefault(); over.set(true)"
        (dragleave)="over.set(false)"
        (drop)="onDrop($event)"
        role="button"
        tabindex="0"
        (keydown.enter)="input.click()"
        (keydown.space)="input.click()"
        aria-label="Choose a spreadsheet to upload"
      >
        <input #input type="file" [accept]="accept" class="hidden" data-testid="file-input" (change)="onPick($event)" />
        <div class="w-16 h-16 rounded-2xl bg-white mx-auto mb-3.5 grid place-items-center shadow-[0_6px_16px_rgba(29,78,216,.15)]"><app-icon name="file" /></div>
        <h3 class="text-[18px] font-bold">{{ loaded() ? 'Drop another file to replace' : 'Drag & drop the monthly Excel file here' }}</h3>
        <div class="sub">or <span class="link">browse files</span> · .xlsx, .xls, .xlsb, .ods, .csv, .tsv</div>
        @if (!loaded()) {
          <div class="flex flex-wrap gap-2 justify-center mt-3.5">
            @for (f of fields; track f.field; let i = $index) {
              <span class="pill i bg-white border border-[#c7d2fe]">{{ i + 1 }}. {{ f.label }}</span>
            }
          </div>
        }
      </div>

      @if (readError()) {
        <div class="pill r mt-4 !rounded-xl !px-4 !py-3 !text-[13.5px] w-full">{{ readError() }}</div>
      }
      @if (savedError()) {
        <div class="pill r mt-4 !rounded-xl !px-4 !py-3 !text-[13.5px] w-full">{{ savedError() }}</div>
      }

      @if (loaded(); as l) {
        @if (sheet(); as sh) {
          <div class="panel flex items-center gap-4 px-5 py-4 mt-5">
            <div class="w-[42px] h-[42px] rounded-[10px] bg-[#e7f6ec] grid place-items-center text-[#15803d] font-extrabold text-[12px]">{{ ext(l.file.name) }}</div>
            <div class="flex-1">
              <div class="font-bold">{{ l.file.name }}</div>
              <div class="sub text-[12.5px]">
                {{ (l.file.size / 1024).toFixed(0) }} KB · header on row {{ sh.headerRowNumber }} · {{ fmt(sh.rows.length) }} rows
                @if (validation()) {
                  · {{ fmt(stats().employees) }} employees · {{ fmt(stats().enrollments) }} enrollments · {{ stats().hyperscalers }} HyperScalers · {{ stats().levels }} levels
                }
              </div>
            </div>
            @if (l.wb.sheets.length > 1) {
              <label class="flex items-center gap-2 text-[13px] text-muted">
                Sheet
                <select class="sel" (change)="pickSheet(+$any($event.target).value)">
                  @for (s of l.wb.sheets; track s.name; let i = $index) {
                    <option [value]="i" [selected]="i === l.sheetIdx">{{ s.name }} ({{ s.rows.length }} rows)</option>
                  }
                </select>
              </label>
            }
            <span class="pill" [class.a]="missing().length || undecided()" [class.g]="!missing().length && !undecided()">
              {{ missing().length ? missing().length + ' column(s) to map' : undecided() ? undecided() + ' value(s) need your decision' : '✓ Ready' }}
            </span>
          </div>

          @if (validation(); as v) {
            @if (undecided() > 0 || v.newHyperscalers.length > 0 || decidedKeys().status.length + decidedKeys().level.length > 0) {
              <div class="decide mt-5 overflow-hidden" role="region" aria-label="Needs your decision">
                <div class="px-5 pt-4 pb-2">
                  <div class="h2" style="color: #92400e">Needs your decision</div>
                  <div class="h2-sub" style="color: #78350f">These values aren't covered by the rules. Your choice is remembered and applied automatically to future uploads.</div>
                </div>
                <table class="data">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Value in file</th>
                      <th>Where</th>
                      <th style="width: 280px">Treat as</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (u of statusList(); track u.key) {
                      <tr>
                        <td>Certificate done/WIP</td>
                        <td><b>"{{ u.raw }}"</b></td>
                        <td class="muted">{{ u.count ? u.count + ' · ' + rowsText(u) : 'decided' }}</td>
                        <td>
                          <select class="sel w-full" [class.need]="!choices().status[u.key]" (change)="choose('status', u.key, $any($event.target).value || undefined)" [attr.aria-label]="'Status for &quot;' + u.raw + '&quot;'">
                            <option value="" [selected]="!choices().status[u.key]">Choose…</option>
                            @for (o of statusOptions; track o.v) {
                              <option [value]="o.v" [selected]="choices().status[u.key] === o.v">{{ o.l }}</option>
                            }
                          </select>
                        </td>
                      </tr>
                    }
                    @for (u of levelList(); track u.key) {
                      <tr>
                        <td>Certification Levels</td>
                        <td><b>"{{ u.raw }}"</b></td>
                        <td class="muted">{{ u.count ? u.count + ' · ' + rowsText(u) : 'decided' }}</td>
                        <td>
                          <select class="sel w-full" [class.need]="choices().level[u.key] === undefined" (change)="chooseLevel(u.key, $any($event.target).value)" [attr.aria-label]="'Level for &quot;' + u.raw + '&quot;'">
                            <option value="" [selected]="choices().level[u.key] === undefined">Choose…</option>
                            @for (n of levelOptions(); track n) {
                              <option [value]="n" [selected]="choices().level[u.key] === n">L{{ n }}</option>
                            }
                            <option value="skip" [selected]="choices().level[u.key] === 'skip'">Skip these rows</option>
                          </select>
                        </td>
                      </tr>
                    }
                    @for (h of v.newHyperscalers; track h.key) {
                      <tr>
                        <td>HyperScaler <span class="tag-new">new</span></td>
                        <td><b>"{{ h.raw }}"</b></td>
                        <td class="muted">{{ h.count }} · {{ rowsText(h) }}</td>
                        <td>
                          <select class="sel w-full" (change)="chooseHs(h, $any($event.target).value)" [attr.aria-label]="'HyperScaler for &quot;' + h.raw + '&quot;'">
                            <option [value]="h.name" [selected]="!choices().hyperscaler[h.key]">Add as a new HyperScaler "{{ h.name }}"</option>
                            @for (o of hsOptions(); track o) {
                              @if (o !== h.name) {
                                <option [value]="o" [selected]="choices().hyperscaler[h.key] === o">Same as {{ o }}</option>
                              }
                            }
                          </select>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }

          <div class="grid grid-cols-[320px_1fr] gap-5 mt-5 items-start">
            <div class="panel p-5">
              <h4 class="font-bold mb-3">Column check</h4>
              @for (f of fields; track f.field; let i = $index) {
                <div class="flex justify-between items-center gap-3 py-2 border-b border-[#eef2ff] last:border-0 text-[13.5px]">
                  <span>
                    <span class="text-muted text-[11.5px] mr-1">{{ i + 1 }}.</span>{{ f.label }}
                    @if (!f.required) {
                      <span class="text-muted text-[11.5px]"> (optional)</span>
                    }
                  </span>
                  <select
                    class="text-[12.5px] font-semibold rounded-md border px-1.5 py-1 max-w-[150px]"
                    [class]="colClass(l.mapping[f.field], f.required)"
                    (change)="setMapping(f.field, $any($event.target).value)"
                    [attr.aria-label]="'Column for ' + f.label"
                  >
                    <option value="" [selected]="l.mapping[f.field] == null">{{ f.required ? '✗ Choose column' : '— Not in file' }}</option>
                    @for (h of sh.headers; track hi; let hi = $index) {
                      <option [value]="hi" [selected]="l.mapping[f.field] === hi">✓ {{ h || 'Column ' + (hi + 1) }}</option>
                    }
                  </select>
                </div>
              }
            </div>

            <div class="flex flex-col gap-5 min-w-0">
              <div class="panel overflow-hidden">
                <div class="px-5 pt-4 pb-3 font-bold">
                  Preview <span class="sub font-normal">· first {{ Math.min(8, validation()?.rows?.length ?? 0) }} of {{ fmt(validation()?.rows?.length ?? 0) }} rows ready to save</span>
                </div>
                @if (validation(); as v) {
                  <div class="overflow-x-auto">
                    <table class="data">
                      <thead>
                        <tr>
                          <th>Row</th>
                          @for (f of fields; track f.field) {
                            <th>{{ f.label }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of preview(); track r.sourceRow) {
                          <tr>
                            <td class="text-muted">{{ r.sourceRow }}</td>
                            <td>{{ r.empId }}</td>
                            <td class="whitespace-nowrap">{{ r.name }}</td>
                            <td>{{ r.reportingOrg }}</td>
                            <td>{{ r.band }}</td>
                            <td class="whitespace-nowrap">{{ r.hyperscaler }}</td>
                            <td class="whitespace-nowrap">{{ r.eta ? iso(r.eta) : '—' }}</td>
                            <td class="whitespace-nowrap"><i class="dot {{ r.status }} mr-1.5"></i>{{ label[r.status] }}</td>
                            <td>
                              @if (r.level) {
                                L{{ r.level }}
                              } @else {
                                <span class="muted">—</span>
                              }
                            </td>
                            <td>{{ r.email }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <div class="px-5 pb-5 text-muted">{{ savedLoading() ? 'Loading your saved choices…' : 'Map the required columns to see a preview.' }}</div>
                }
              </div>

              @if (validation(); as v) {
                @if (v.issues.length) {
                  <div class="panel overflow-hidden">
                    <div class="px-5 py-3.5 font-bold flex gap-2 items-center">
                      Rows needing attention
                      @if (errors().length) {
                        <span class="pill r">{{ errors().length }} will be skipped</span>
                      }
                      @if (warnings().length) {
                        <span class="pill a">{{ warnings().length }} warnings</span>
                      }
                    </div>
                    <table class="data">
                      <thead>
                        <tr>
                          <th style="width: 80px">Row</th>
                          <th style="width: 120px">Emp ID</th>
                          <th>Issue</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (i of v.issues.slice(0, 10); track $index) {
                          <tr>
                            <td>#{{ i.row }}</td>
                            <td>{{ i.empId || '—' }}</td>
                            <td><span class="pill" [class.r]="i.severity === 'error'" [class.a]="i.severity !== 'error'">{{ i.reason }}</span></td>
                            <td class="text-muted">{{ i.value }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    @if (v.issues.length > 10) {
                      <div class="px-5 py-2.5 text-muted text-[12.5px]">+{{ v.issues.length - 10 }} more. Download the full list from the import summary.</div>
                    }
                  </div>
                }
              }
            </div>
          </div>

          @if (importError()) {
            <div class="pill r mt-5 !rounded-xl !px-4 !py-3 !text-[13.5px] w-full">Import failed: {{ importError() }}</div>
          }

          <div class="flex justify-end items-center gap-3 mt-5">
            <span class="sub mr-auto">
              @if (missing().length) {
                Map {{ missingLabels() }} to continue.
              } @else if (undecided()) {
                Decide the {{ undecided() }} value(s) above to continue.
              } @else if (validation()) {
                {{ fmt(validation()!.rows.length) }} rows will be saved as <b>{{ thisMonth }}</b> data: <code>{{ fileHint() }}…csv</code>
              }
            </span>
            <button class="btn ghost" (click)="loaded.set(null)">Cancel</button>
            <button class="btn primary" [disabled]="busy() || data.isPast() || !validation() || !validation()!.rows.length || undecided() > 0" (click)="doImport()">
              {{ busy() ? 'Saving…' : 'Save this month →' }}
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class UploadPage implements OnInit {
  data = inject(DataService);
  private router = inject(Router);
  @ViewChild('input') inputRef?: ElementRef<HTMLInputElement>;

  crumbs = [{ label: 'Overall', to: '/' }, { label: 'Upload monthly sheet' }];
  fields = FIELDS;
  accept = ACCEPTED_EXTENSIONS.join(',');
  thisMonth = monthOf(new Date());
  label = STATUS_LABEL;
  fmt = fmtNum;
  iso = fmtIso;
  Math = Math;
  statusOptions: { v: St | 'skip'; l: string }[] = [
    { v: 'done', l: 'Completed' },
    { v: 'wip', l: 'In progress' },
    { v: 'ns', l: 'Not started' },
    { v: 'skip', l: 'Skip these rows' },
  ];

  over = signal(false);
  loaded = signal<Loaded | null>(null);
  readError = signal<string | null>(null);
  busy = signal(false);
  importError = signal<string | null>(null);
  /** Decisions made on this screen (saved to mappings.json on import). */
  choices = signal<Mappings>(emptyMappings());
  private saved = signal<Mappings | null>(null);
  savedLoading = signal(true);
  savedError = signal<string | null>(null);

  sheet = computed(() => {
    const l = this.loaded();
    return l ? l.wb.sheets[l.sheetIdx] : null;
  });
  missing = computed(() => {
    const l = this.loaded();
    return l ? missingRequired(l.mapping) : [];
  });
  missingLabels = computed(() => this.missing().map((m) => m.label).join(', '));
  mappings = computed(() => merge(this.saved() ?? emptyMappings(), this.choices()));
  validation = computed(() => {
    const l = this.loaded();
    const sh = this.sheet();
    const saved = this.saved();
    if (!l || !sh || this.missing().length || !saved) return null;
    return validateRows(sh, l.mapping, this.mappings(), l.wb.date1904, undefined, new Set(Object.keys(saved.hyperscaler)));
  });
  preview = computed<CleanRow[]>(() => this.validation()?.rows.slice(0, 8) ?? []);
  errors = computed(() => this.validation()?.issues.filter((i) => i.severity === 'error') ?? []);
  warnings = computed(() => this.validation()?.issues.filter((i) => i.severity === 'warning') ?? []);
  undecided = computed(() => (this.validation()?.unknownStatus.length ?? 0) + (this.validation()?.unknownLevel.length ?? 0));
  stats = computed(() => {
    const rows = this.validation()?.rows ?? [];
    return {
      employees: new Set(rows.map((r) => r.empId.toUpperCase())).size,
      enrollments: new Set(rows.map((r) => `${r.empId.toUpperCase()}|${r.hyperscaler}`)).size,
      hyperscalers: new Set(rows.map((r) => r.hyperscaler)).size,
      levels: rows.reduce((m, r) => Math.max(m, r.level), 0),
    };
  });
  hsOptions = computed(() => [...new Set([...KNOWN_HYPERSCALERS, ...this.data.dataset().hyperscalers])]);
  levelOptions = computed(() => Array.from({ length: Math.max(4, this.stats().levels, this.data.dataset().N) + 1 }, (_, i) => i + 1));
  decidedKeys = computed(() => ({ status: Object.keys(this.choices().status), level: Object.keys(this.choices().level) }));
  /** Values already decided on this screen stay listed so the choice can be changed. */
  statusList = computed<UnknownValue[]>(() => {
    const u = this.validation()?.unknownStatus ?? [];
    return [...u, ...this.decidedKeys().status.filter((k) => !u.some((x) => x.key === k)).map((k) => ({ key: k, raw: k, count: 0, rows: [] }))];
  });
  levelList = computed<UnknownValue[]>(() => {
    const u = this.validation()?.unknownLevel ?? [];
    return [...u, ...this.decidedKeys().level.filter((k) => !u.some((x) => x.key === k)).map((k) => ({ key: k, raw: k, count: 0, rows: [] }))];
  });
  fileHint = computed(() => buildSnapshotId(this.validation()?.latestDoneDate ?? null, new Date()).slice(0, 13));

  async ngOnInit() {
    try {
      this.saved.set(await fetchMappings());
    } catch (e) {
      this.savedError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.savedLoading.set(false);
    }
  }

  ext(name: string) {
    return name.split('.').pop()?.toUpperCase().slice(0, 4) ?? '';
  }
  rowsText(u: UnknownValue) {
    return `row${u.rows.length > 1 ? 's' : ''} ${u.rows.slice(0, 5).join(', ')}${u.rows.length > 5 ? '…' : ''}`;
  }
  colClass(idx: number | null, required: boolean) {
    const base = 'text-[12.5px] font-semibold rounded-md border px-1.5 py-1 max-w-[150px] ';
    return base + (idx != null ? 'text-[#16a34a] border-[#bbf7d0] bg-[#f0fdf4]' : required ? 'text-[#dc2626] border-[#fecaca] bg-[#fef2f2]' : 'text-muted border-line');
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.over.set(false);
    const f = ev.dataTransfer?.files[0];
    if (f) void this.onFile(f);
  }
  onPick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) void this.onFile(f);
    input.value = '';
  }
  async onFile(file: File) {
    this.readError.set(null);
    this.importError.set(null);
    this.choices.set(emptyMappings());
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      this.readError.set(`"${file.name}" isn't a spreadsheet. Use one of: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }
    try {
      const wb = readWorkbook(await file.arrayBuffer());
      if (!wb.sheets.length) {
        this.readError.set('No table found in this file. Make sure it has a header row with the column names.');
        return;
      }
      const sheetIdx = defaultSheetIndex(wb);
      this.loaded.set({ file, wb, sheetIdx, mapping: autoMapColumns(wb.sheets[sheetIdx].headers) });
    } catch (e) {
      this.readError.set(`Couldn't read this file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  pickSheet(sheetIdx: number) {
    const l = this.loaded();
    if (l) this.loaded.set({ ...l, sheetIdx, mapping: autoMapColumns(l.wb.sheets[sheetIdx].headers) });
  }
  setMapping(field: Field, v: string) {
    const l = this.loaded();
    if (l) this.loaded.set({ ...l, mapping: { ...l.mapping, [field]: v === '' ? null : Number(v) } });
  }
  choose(kind: 'status', key: string, value: St | 'skip' | undefined) {
    this.choices.update((c) => {
      const next = { ...c[kind] };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return { ...c, [kind]: next };
    });
  }
  chooseLevel(key: string, v: string) {
    this.choices.update((c) => {
      const next = { ...c.level };
      if (v === '') delete next[key];
      else next[key] = v === 'skip' ? 'skip' : Number(v);
      return { ...c, level: next };
    });
  }
  chooseHs(h: NewHyperscaler, v: string) {
    this.choices.update((c) => {
      const next = { ...c.hyperscaler };
      if (v === h.name) delete next[h.key];
      else next[h.key] = v;
      return { ...c, hyperscaler: next };
    });
  }

  async doImport() {
    const l = this.loaded();
    const sh = this.sheet();
    const v = this.validation();
    if (!l || !sh || !v || this.undecided()) return;
    this.busy.set(true);
    this.importError.set(null);
    try {
      const choices = this.choices();
      // Remember every decision, including new HyperScalers kept as new.
      const hsDefaults: Record<string, string> = {};
      for (const h of v.newHyperscalers) hsDefaults[h.key] = choices.hyperscaler[h.key] ?? h.name;
      await saveMappings(merge(this.saved() ?? emptyMappings(), { ...choices, hyperscaler: { ...choices.hyperscaler, ...hsDefaults } }));
      const id = await runImport(
        v.rows.map(({ sourceRow: _s, ...r }) => r),
        v.latestDoneDate,
      );
      await this.data.afterUpload();
      const decisions = [
        ...Object.entries(choices.status).map(([k, s]) => `Status "${k}" → ${s === 'skip' ? 'rows skipped' : STATUS_LABEL[s]}`),
        ...Object.entries(choices.level).map(([k, s]) => `Level "${k}" → ${s === 'skip' ? 'rows skipped' : `L${s}`}`),
        ...v.newHyperscalers.map((h) => (hsDefaults[h.key] === h.name ? `HyperScaler "${h.raw}" added as new` : `HyperScaler "${h.raw}" → ${hsDefaults[h.key]}`)),
      ];
      const state: ImportNavState = {
        fileName: l.file.name,
        sheetName: sh.name,
        issues: v.issues,
        rowsSaved: v.rows.length,
        skippedByChoice: v.skippedByChoice,
        decisions,
        newHyperscalers: v.newHyperscalers.filter((h) => hsDefaults[h.key] === h.name).map((h) => h.name),
      };
      await this.router.navigateByUrl(`/uploads/${id}`, { state });
    } catch (e) {
      this.importError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }
}
