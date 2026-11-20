import { Component, ElementRef, HostListener, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { Enrollment } from '../lib/aggregate';
import { BRAND, APP_VERSION, copyrightText } from '../lib/brand';
import { dataMonth, fmtDate, fmtDateTime, fmtIso, fmtNum, snapshotLabel } from '../lib/format';
import { downloadText, toCsv } from '../lib/csv';
import { hsUrl } from '../lib/links';
import { DataService } from '../core/data.service';
import { SnapLinkDirective } from '../core/snap-link.directive';
import { IconComponent } from './basics';

/* ---------------- Month picker ---------------- */

/** "Month · Nov 2026 · Latest ▾": switch the whole app to a previous monthly upload. */
@Component({
  selector: 'app-snapshot-picker',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (data.snapshots().length) {
      <div class="relative">
        <button class="chip" [class.past]="data.isPast()" (click)="open.set(!open())" aria-haspopup="listbox" [attr.aria-expanded]="open()">
          <app-icon name="history" />
          <span class="text-muted">Month</span>
          <b>{{ current }}</b>
          <span class="mon-tag" [class.past]="data.isPast()">{{ data.isPast() ? 'Past' : 'Latest' }}</span>
          <span aria-hidden="true">▾</span>
        </button>
        @if (open()) {
          <div class="popover right-0 mt-2 w-[380px] max-h-[420px] overflow-auto p-1.5" role="listbox">
            <div class="k px-3 pt-2 pb-1.5">Monthly uploads · newest first</div>
            @for (s of data.snapshots(); track s.id; let i = $index) {
              <button
                role="option"
                [attr.aria-selected]="s.id === data.snapshotId()"
                (click)="pick(i === 0 ? null : s.id)"
                class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 cursor-pointer"
                [class.bg-wash]="s.id === data.snapshotId()"
              >
                <span class="w-2 h-2 rounded-full" [class.bg-brand]="s.id === data.snapshotId()" [class.bg-line]="s.id !== data.snapshotId()"></span>
                <span class="flex-1">
                  <span class="font-semibold block">{{ month(s.id) }} data @if (i === 0) {<span class="pill i ml-1">Latest</span>}</span>
                  <span class="text-[12px] text-muted">Uploaded {{ dt(s.uploadedAt) }} · latest completion {{ d(s.dataUpTo) }}</span>
                </span>
              </button>
            }
          </div>
        }
      </div>
    }
  `,
})
export class SnapshotPickerComponent {
  data = inject(DataService);
  private el = inject(ElementRef<HTMLElement>);
  open = signal(false);
  month = dataMonth;
  dt = fmtDateTime;
  d = fmtDate;
  get current() {
    const id = this.data.snapshotId() ?? this.data.snapshots()[0]?.id;
    return id ? dataMonth(id) : '—';
  }
  pick(id: string | null) {
    this.data.setSnapshot(id);
    this.open.set(false);
  }
  @HostListener('document:mousedown', ['$event'])
  outside(ev: MouseEvent) {
    if (this.open() && !this.el.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }
  @HostListener('document:keydown.escape')
  esc() {
    this.open.set(false);
  }
}

/* ---------------- Header (design W2) ---------------- */

/** One light bar: wide wordmark logo · product title · navigation · Month · Upload. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [SnapLinkDirective, RouterLink, RouterLinkActive, SnapshotPickerComponent, IconComponent],
  template: `
    <header class="app-hdr">
      <a snapLink="/" class="app-brand" [attr.aria-label]="brand.name + ': ' + brand.product + ' home'"><img class="app-logo" [src]="brand.logo" [alt]="brand.name + ' logo'" /></a>
      <span class="app-sep" aria-hidden="true"></span>
      <a snapLink="/" class="app-title">{{ brand.product }}</a>
      <nav class="hnav" aria-label="Main">
        <a [routerLink]="['/']" [queryParams]="qp()" [class.active]="isDash">Dashboard</a>
        <a [routerLink]="['/people']" [queryParams]="qp()" routerLinkActive="active">Employees</a>
        <a [routerLink]="['/uploads']" [queryParams]="qp()" routerLinkActive="active">Uploads</a>
      </nav>
      <app-snapshot-picker />
      <button class="btn-up" [disabled]="data.isPast()" [title]="data.isPast() ? 'Switch to the latest data to upload' : 'Upload the monthly Excel / CSV'" (click)="router.navigateByUrl('/upload')">
        <app-icon name="upload" /> Upload
      </button>
    </header>
  `,
})
export class HeaderComponent {
  data = inject(DataService);
  router = inject(Router);
  brand = BRAND;
  /** Keeps the selected past month while switching pages (a stable object for the bindings). */
  qp = computed(() => {
    const s = this.data.param();
    return s ? { snapshot: s } : {};
  });
  get isDash() {
    const p = this.router.url.split('?')[0];
    return p === '/' || p.startsWith('/hs/');
  }
}

/* ---------------- Footer (design F2) ---------------- */

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="app-ftr">
      <img class="ftr-logo" [src]="brand.logo" alt="" aria-hidden="true" />
      <span>{{ copyright }}</span>
      <span class="ftr-right">
        @if (data.snapshotId(); as id) {
          <span>📅 {{ month(id) }} data{{ data.isPast() ? ' (past month)' : '' }}</span>
          <span>⤒ Uploaded {{ label(id) }}</span>
        }
        <span class="ftr-ver">v{{ version }}</span>
      </span>
    </footer>
  `,
})
export class FooterComponent {
  data = inject(DataService);
  brand = BRAND;
  version = APP_VERSION;
  copyright = copyrightText();
  month = dataMonth;
  label = snapshotLabel;
}

/* ---------------- employee table ---------------- */

type SortKey = 'empId' | 'name' | 'reportingOrg' | 'band' | 'hyperscaler' | 'status' | 'highest' | 'latestEta';
const ST_ORDER: Record<St, number> = { done: 0, wip: 1, ns: 2 };
const ST_SHORT: Record<St, string> = { done: '✓', wip: '◐', ns: '–' };
const PAGE = 50;

export function exportPeopleCsv(list: Enrollment[], N: number, fileName: string) {
  const levels = Array.from({ length: N }, (_, i) => i + 1);
  const fields = ['Emp ID', 'Name', 'Email ID', 'Reporting Orgn', 'Band', 'HyperScaler', 'Status', 'Highest level completed', ...levels.flatMap((l) => [`L${l} status`, `L${l} ETA`])];
  const data = list.map((e) => [
    e.empId,
    e.name,
    e.email,
    e.reportingOrg,
    e.band,
    e.hyperscaler,
    STATUS_LABEL[e.status],
    e.highest ? `L${e.highest}` : 'None',
    ...e.levels.flatMap((s, i) => [STATUS_LABEL[s], e.etas[i]]),
  ]);
  downloadText(fileName, toCsv(fields, data));
}

@Component({
  selector: 'app-people-table',
  standalone: true,
  imports: [SnapLinkDirective],
  template: `
    <div class="panel overflow-hidden">
      <ng-content select="[toolbar]" />
      @if (!list.length) {
        <div class="empty m-4">Nobody matches these filters.</div>
      } @else {
        <div class="overflow-x-auto">
          <table class="data">
            <thead>
              <tr>
                @for (c of cols; track c.k) {
                  @if (c.k === 'email') {
                    <th>Email ID</th>
                  } @else if (!(hideHs && c.k === 'hyperscaler')) {
                    <th [class.sorted]="sort.k === c.k" [attr.aria-sort]="sort.k === c.k ? (sort.asc ? 'ascending' : 'descending') : 'none'">
                      <button (click)="sortBy($any(c.k))">{{ c.k === 'highest' ? 'Levels (L1–L' + N + ')' : c.label }}{{ sort.k === c.k ? (sort.asc ? ' ▴' : ' ▾') : '' }}</button>
                    </th>
                  }
                }
              </tr>
            </thead>
            <tbody>
              @for (e of rows; track e.key) {
                <tr>
                  <td class="font-mono text-[12.5px]">{{ e.empId }}</td>
                  <td class="font-semibold whitespace-nowrap">
                    @if (e.name) {
                      {{ e.name }}
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    @if (e.email) {
                      <a class="link font-normal" [href]="'mailto:' + e.email">{{ e.email }}</a>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    @if (e.reportingOrg) {
                      {{ e.reportingOrg }}
                    } @else {
                      <span class="muted">Not given</span>
                    }
                  </td>
                  <td>
                    @if (e.band) {
                      {{ e.band }}
                    } @else {
                      <span class="muted">Not given</span>
                    }
                  </td>
                  @if (!hideHs) {
                    <td class="whitespace-nowrap"><a class="link" [snapLink]="hs(e.hyperscaler)">{{ e.hyperscaler }}</a></td>
                  }
                  <td>
                    <span class="inline-flex gap-1">
                      @for (s of e.levels; track i; let i = $index) {
                        <span class="st {{ s }}" [title]="chipTitle(e, i)" [attr.aria-label]="'L' + (i + 1) + ' ' + label[s]">L{{ i + 1 }}<span class="ml-0.5 opacity-80" aria-hidden="true">{{ short[s] }}</span></span>
                      }
                    </span>
                  </td>
                  <td class="whitespace-nowrap"><i class="dot {{ e.status }} mr-1.5"></i>{{ label[e.status] }}</td>
                  <td class="whitespace-nowrap">{{ iso(e.latestEta) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!limit && pages > 1) {
          <div class="pager flex items-center gap-2 justify-end px-4 py-3 border-t border-line text-[13px]">
            <span class="muted mr-auto">{{ fmt(p * PAGE + 1) }}–{{ fmt(Math.min(sorted.length, (p + 1) * PAGE)) }} of {{ fmt(sorted.length) }}</span>
            <button [disabled]="p === 0" (click)="page = p - 1; recompute()" aria-label="Previous page">‹</button>
            <span>Page {{ p + 1 }} of {{ pages }}</span>
            <button [disabled]="p >= pages - 1" (click)="page = p + 1; recompute()" aria-label="Next page">›</button>
          </div>
        }
      }
    </div>
  `,
})
export class PeopleTableComponent implements OnChanges {
  @Input({ required: true }) list!: Enrollment[];
  @Input({ required: true }) N!: number;
  /** Hide the HyperScaler column (inside a HyperScaler view). */
  @Input() hideHs = false;
  /** Show only the first n rows, no pager (embedded use). */
  @Input() limit?: number;

  readonly PAGE = PAGE;
  Math = Math;
  fmt = fmtNum;
  iso = fmtIso;
  hs = hsUrl;
  label = STATUS_LABEL;
  short = ST_SHORT;
  cols: { k: SortKey | 'email'; label: string }[] = [
    { k: 'empId', label: 'Emp ID' },
    { k: 'name', label: 'Name' },
    { k: 'email', label: 'Email ID' },
    { k: 'reportingOrg', label: 'Reporting Orgn' },
    { k: 'band', label: 'Band' },
    { k: 'hyperscaler', label: 'HyperScaler' },
    { k: 'highest', label: 'Levels' },
    { k: 'status', label: 'Status' },
    { k: 'latestEta', label: 'Latest ETA' },
  ];
  sort: { k: SortKey; asc: boolean } = { k: 'empId', asc: true };
  page = 0;
  sorted: Enrollment[] = [];
  rows: Enrollment[] = [];
  pages = 1;
  p = 0;

  ngOnChanges() {
    this.page = 0;
    this.resort();
  }
  sortBy(k: SortKey) {
    this.sort = { k, asc: this.sort.k === k ? !this.sort.asc : k !== 'highest' };
    this.page = 0;
    this.resort();
  }
  chipTitle(e: Enrollment, i: number) {
    return `L${i + 1}: ${STATUS_LABEL[e.levels[i]]}${e.etas[i] ? ` · ETA ${fmtIso(e.etas[i])}` : ''}`;
  }
  private resort() {
    const { k, asc } = this.sort;
    const dir = asc ? 1 : -1;
    const val = (e: Enrollment): string | number => (k === 'status' ? ST_ORDER[e.status] : k === 'highest' ? e.highest : k === 'latestEta' ? e.latestEta || '9999' : e[k].toLowerCase());
    this.sorted = [...this.list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir || a.empId.localeCompare(b.empId, undefined, { numeric: true });
    });
    this.recompute();
  }
  recompute() {
    this.pages = Math.max(1, Math.ceil(this.sorted.length / PAGE));
    this.p = Math.min(this.page, this.pages - 1);
    this.rows = this.limit ? this.sorted.slice(0, this.limit) : this.sorted.slice(this.p * PAGE, this.p * PAGE + PAGE);
  }
}
