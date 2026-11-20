import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { RowIssue } from '../types';
import type { Dataset } from '../lib/aggregate';
import { buildDataset } from '../lib/aggregate';
import { fetchSnapshotText } from '../lib/api';
import { downloadText, issuesToCsv } from '../lib/csv';
import { dataMonth, fmtDate, fmtDateTime, fmtNum, snapshotLabel } from '../lib/format';
import { isSnapshotId } from '../lib/snapshotName';
import { DataService } from '../core/data.service';
import { SnapLinkDirective } from '../core/snap-link.directive';
import { BreadcrumbComponent, DataQualityComponent } from '../ui/basics';
import { NumberTileComponent, StatRowComponent } from '../ui/fluid';

/** Passed from the Upload page to the import summary (router navigation state). */
export interface ImportNavState {
  fileName: string;
  sheetName: string;
  issues: RowIssue[];
  rowsSaved: number;
  skippedByChoice: number;
  /** Values decided in this upload, e.g. ["Status \"Certified\" → Completed"]. */
  decisions: string[];
  newHyperscalers: string[];
}

@Component({
  selector: 'app-uploads',
  standalone: true,
  imports: [BreadcrumbComponent, RouterLink],
  template: `
    <app-breadcrumb [parts]="crumbs" />
    <div class="page stack">
      <div>
        <h1 class="title">Monthly uploads</h1>
        <div class="sub mt-1">Each upload is one month's data (the month it was uploaded), kept as its own file in <code>local-data/</code>. Open any month to see the dashboard as it was.</div>
      </div>
      <div class="panel overflow-hidden">
        @if (!list().length) {
          <div class="empty big m-5"><b>No uploads yet.</b><a class="link" routerLink="/upload">Upload this month's sheet →</a></div>
        } @else {
          <table class="data">
            <thead>
              <tr>
                <th>Data month</th>
                <th>Uploaded</th>
                <th>Latest completion in file</th>
                <th>File</th>
                <th class="text-right">Size</th>
                <th style="width: 330px">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (s of list(); track s.id; let i = $index) {
                <tr>
                  <td><b>{{ month(s.id) }}</b> @if (i === 0) {<span class="pill i ml-1">Latest</span>}</td>
                  <td>{{ dt(s.uploadedAt) }}</td>
                  <td>{{ d(s.dataUpTo) }}</td>
                  <td class="text-muted font-mono text-[12.5px]">{{ s.id }}.csv</td>
                  <td class="text-right muted">{{ (s.sizeBytes / 1024).toFixed(0) }} KB</td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn sm primary" (click)="view(i === 0 ? null : s.id)">View this data</button>
                      <button class="btn sm ghost" (click)="router.navigateByUrl('/uploads/' + s.id)">Summary</button>
                      <button class="btn sm ghost" (click)="download(s.id)" [attr.aria-label]="'Download ' + s.id + '.csv'">CSV</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class UploadsPage {
  data = inject(DataService);
  router = inject(Router);
  list = this.data.snapshots;
  crumbs = [{ label: 'Overall', to: '/' }, { label: 'Uploads' }];
  month = dataMonth;
  dt = fmtDateTime;
  d = fmtDate;
  view(id: string | null) {
    void this.router.navigate(['/'], { queryParams: id ? { snapshot: id } : {} });
  }
  async download(id: string) {
    downloadText(`${id}.csv`, await fetchSnapshotText(id));
  }
}

@Component({
  selector: 'app-import-summary',
  standalone: true,
  imports: [BreadcrumbComponent, DataQualityComponent, NumberTileComponent, StatRowComponent, SnapLinkDirective],
  template: `
    @if (!valid) {
      <div class="page"><div class="empty big">Unknown upload.</div></div>
    } @else if (error()) {
      <div class="page"><div class="empty big">{{ error() }}</div></div>
    } @else if (!ds()) {
      <div class="page muted">Loading…</div>
    } @else {
      <app-breadcrumb [parts]="crumbs" />
      <div class="page stack">
        <div class="vhead">
          <div>
            <h2>{{ state ? '✓ Saved: ' : '' }}{{ month(id) }} data</h2>
            <span class="meta">
              Uploaded {{ label(id) }}
              @if (state) {
                · from <b>{{ state.fileName }}</b> (sheet {{ state.sheetName }})
              }
              · <code>{{ id }}.csv</code>
            </span>
          </div>
          <a [snapLink]="viewUrl()" class="btn primary ml-auto">View the dashboard →</a>
        </div>
        <div class="grid grid-cols-5 gap-[21px]">
          @for (t of tiles(); track t.k; let i = $index) {
            <app-number-tile [i]="i" [label]="t.k" [value]="t.v" [sub]="t.note" />
          }
        </div>
        <div class="sec">Status in this month</div>
        <app-stat-row [sum]="ds()!.summary" totalLabel="Total enrolled" [totalSub]="fmt(ds()!.summary.employees) + ' employees'" />
        <div class="sec">Checks</div>
        @if (state; as s) {
          <div class="grid2">
            <div class="card">
              <div class="h2">From the upload</div>
              <ul class="mt-2 text-[13.5px] grid gap-1.5">
                <li>
                  <b>{{ fmt(s.rowsSaved) }}</b> rows saved
                  @if (errors) {
                    , <b style="color: var(--red)">{{ errors }}</b> skipped because of errors
                  }
                  @if (s.skippedByChoice) {
                    , {{ s.skippedByChoice }} skipped by your choice
                  }
                  @if (warnings) {
                    , {{ warnings }} warnings
                  }.
                </li>
                @if (s.newHyperscalers.length) {
                  <li><span class="tag-new" style="margin-left: 0">flag</span> New HyperScaler{{ s.newHyperscalers.length > 1 ? 's' : '' }} added automatically: <b>{{ s.newHyperscalers.join(', ') }}</b></li>
                }
                @if (s.decisions.length) {
                  <li>
                    Your choices (remembered for next time):
                    <ul class="ml-5 mt-1 list-disc muted">
                      @for (t of s.decisions; track t) {
                        <li>{{ t }}</li>
                      }
                    </ul>
                  </li>
                }
              </ul>
              @if (s.issues.length) {
                <button class="btn sm ghost mt-3" (click)="downloadIssues()">Download all {{ s.issues.length }} row issues (CSV)</button>
              }
            </div>
            <app-data-quality [q]="ds()!.quality" [sum]="ds()!.summary" />
          </div>
        } @else {
          <app-data-quality [q]="ds()!.quality" [sum]="ds()!.summary" />
        }
      </div>
    }
  `,
})
export class ImportSummaryPage implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  id = this.route.snapshot.paramMap.get('id') ?? '';
  valid = isSnapshotId(this.id);
  /** Present right after an upload (router navigation state). */
  state: ImportNavState | null = (inject(Router).getCurrentNavigation()?.extras.state as ImportNavState | undefined) ?? (history.state?.fileName ? (history.state as ImportNavState) : null);
  ds = signal<Dataset | null>(null);
  error = signal<string | null>(null);
  crumbs = [{ label: 'Overall', to: '/' }, { label: 'Uploads', to: '/uploads' }, { label: `${dataMonth(this.id)} data` }];
  errors = this.state?.issues.filter((i) => i.severity === 'error').length ?? 0;
  warnings = this.state?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  viewUrl = computed(() => (this.data.snapshots()[0]?.id === this.id ? '/' : `/?snapshot=${this.id}`));
  tiles = computed(() => {
    const d = this.ds();
    if (!d) return [];
    return [
      { k: 'Rows saved', v: d.rowCount, note: undefined as string | undefined },
      { k: 'Employees', v: d.summary.employees, note: undefined },
      { k: 'Enrollments', v: d.summary.total, note: 'employee × HyperScaler' },
      { k: 'HyperScalers', v: d.hyperscalers.length, note: undefined },
      { k: 'Levels', v: d.N, note: undefined },
    ];
  });
  month = dataMonth;
  label = snapshotLabel;
  fmt = fmtNum;

  async ngOnInit() {
    if (!this.valid) return;
    try {
      this.ds.set(buildDataset((await this.data.snapshot(this.id)).rows));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
  downloadIssues() {
    if (this.state) downloadText(`${this.id}-issues.csv`, issuesToCsv(this.state.issues));
  }
}
