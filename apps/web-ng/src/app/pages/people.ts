import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { PeopleFilter } from '../lib/aggregate';
import { applyFilter, empKey, summarize } from '../lib/aggregate';
import { dataMonth, fmtNum } from '../lib/format';
import { hsUrl } from '../lib/links';
import { DataService } from '../core/data.service';
import { BreadcrumbComponent, HsLogoComponent, IconComponent, orNone } from '../ui/basics';
import { StatRowComponent } from '../ui/fluid';
import { PeopleTableComponent, exportPeopleCsv } from '../ui/shell';
import type { ParamMap } from '@angular/router';

const isSt = (v: string | null): v is St => v === 'done' || v === 'wip' || v === 'ns';
const FLAGS = {
  skip: 'Completed a level above an uncompleted one',
  dup: 'Has duplicate rows',
  nolevel: 'Has rows with an empty level',
  over: "Has rows above its HyperScaler's levels",
} as const;

/** Read the employee-list filters from the URL. */
function readFilter(p: ParamMap): PeopleFilter {
  const f: PeopleFilter = {};
  if (p.has('hs')) f.hs = p.get('hs')!;
  if (p.has('org')) f.org = p.get('org')!;
  if (p.has('band')) f.band = p.get('band')!;
  const st = p.get('st');
  if (isSt(st)) f.st = st;
  const lv = Number(p.get('lv'));
  const ls = p.get('ls');
  if (Number.isInteger(lv) && lv >= 1 && isSt(ls)) {
    f.lv = lv;
    f.ls = ls;
  }
  if (p.has('hi') && Number.isInteger(Number(p.get('hi')))) f.hi = Number(p.get('hi'));
  const flag = p.get('flag');
  if (flag === 'skip' || flag === 'dup' || flag === 'nolevel' || flag === 'over') f.flag = flag;
  return f;
}

interface Chip {
  label: string;
  keys: string[];
  kind: 'hs' | 'status' | 'other';
  st?: St;
}

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [BreadcrumbComponent, HsLogoComponent, IconComponent, StatRowComponent, PeopleTableComponent],
  template: `
    @if (data.loading() && !data.snapshotId()) {
      <div class="page muted">Loading…</div>
    } @else if (data.error()) {
      <div class="page"><div class="empty big">{{ data.error() }}</div></div>
    } @else {
      <app-breadcrumb [parts]="crumbs()" />
      <div class="page stack">
        <div class="vhead">
          <div>
            <div class="ph-title">
              @if (filter().hs !== undefined) {
                <app-hs-logo [name]="filter().hs!" [sm]="true" />
              }
              <h2>{{ heading() }}</h2>
              @if (filter().st; as st) {
                <span class="st-badge {{ st }}" role="status" [attr.aria-label]="'Status filter: ' + label[st]"><i aria-hidden="true"></i>{{ label[st] }}</span>
              }
              @if (filter().lv && filter().ls) {
                <span class="st-badge {{ filter().ls }}" role="status"><i aria-hidden="true"></i>L{{ filter().lv }} · {{ label[filter().ls!] }}</span>
              }
            </div>
            @if (contextLine()) {
              <div class="ph-context">{{ contextLine() }}</div>
            }
            <span class="meta">{{ fmt(list().length) }} {{ list().length === 1 ? 'enrollment' : 'enrollments' }} · {{ fmt(employees()) }} {{ employees() === 1 ? 'employee' : 'employees' }} · one row per employee × HyperScaler</span>
          </div>
        </div>

        <app-stat-row [sum]="sum()" totalLabel="In this list" [totalSub]="totalSub()" [active]="filter().st" [to]="statusLink" />

        <app-people-table [list]="list()" [N]="d().N">
          <div toolbar class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
            <label class="search w-[280px]">
              <app-icon name="search" />
              <input [value]="q()" (input)="q.set($any($event.target).value)" placeholder="Search Emp ID, name, email…" aria-label="Search employees" />
            </label>
            <select class="sel" [value]="filter().hs ?? '__all'" (change)="setParam('hs', $any($event.target).value)" aria-label="HyperScaler">
              <option value="__all">All HyperScalers</option>
              @for (h of d().hyperscalers; track h) {
                <option [value]="h" [selected]="filter().hs === h">{{ h }}</option>
              }
            </select>
            <select class="sel max-w-[200px]" (change)="setParam('org', $any($event.target).value)" aria-label="Reporting Orgn">
              <option value="__all" [selected]="filter().org === undefined">All Reporting Orgns</option>
              @for (o of orgs(); track o) {
                <option [value]="o" [selected]="filter().org === o">{{ orNone(o) }}</option>
              }
            </select>
            <select class="sel" (change)="setParam('band', $any($event.target).value)" aria-label="Band">
              <option value="__all" [selected]="filter().band === undefined">All Bands</option>
              @for (b of bands(); track b) {
                <option [value]="b" [selected]="filter().band === b">{{ orNone(b) }}</option>
              }
            </select>
            <select class="sel" [class.st-sel]="!!filter().st" [class.done]="filter().st === 'done'" [class.wip]="filter().st === 'wip'" [class.ns]="filter().st === 'ns'" (change)="setParam('st', $any($event.target).value)" aria-label="Status">
              <option value="__all" [selected]="!filter().st">Any status</option>
              @for (s of sts; track s) {
                <option [value]="s" [selected]="filter().st === s">{{ label[s] }}</option>
              }
            </select>
            <button class="btn sm ghost ml-auto" [disabled]="!list().length" (click)="exportCsv()"><app-icon name="download" /> Export CSV</button>
            @if (chips().length) {
              <div class="w-full flex flex-wrap gap-2 items-center pt-1">
                <span class="k">Filters</span>
                @for (c of chips(); track c.label) {
                  <span class="fchip" [class.st-chip]="c.kind === 'status'" [class.hs-chip]="c.kind === 'hs'" [class.done]="c.st === 'done'" [class.wip]="c.st === 'wip'" [class.ns]="c.st === 'ns'">
                    @if (c.kind === 'status') {
                      <i class="dot {{ c.st }}" aria-hidden="true"></i>
                    }
                    @if (c.kind === 'hs') {
                      <app-hs-logo [name]="filter().hs!" [sm]="true" />
                    }
                    {{ c.label }}
                    <button (click)="remove(c.keys)" [attr.aria-label]="'Remove filter ' + c.label">×</button>
                  </span>
                }
                <button class="link text-[12.5px]" (click)="remove(['hs', 'org', 'band', 'st', 'lv', 'ls', 'hi', 'flag'])">Clear all</button>
              </div>
            }
          </div>
        </app-people-table>
        <div class="text-[12px] muted">
          Status = Completed when the top level (L{{ d().N }}) is completed, In progress when any level is started, otherwise Not started. Hover a level chip for its status and ETA. ✓ completed ·
          ◐ in progress · – not started.
        </div>
      </div>
    }
  `,
})
export class PeoplePage {
  data = inject(DataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  d = this.data.dataset;
  label = STATUS_LABEL;
  sts: St[] = ['done', 'wip', 'ns'];
  fmt = fmtNum;
  orNone = orNone;

  private params = toSignal(this.route.queryParamMap, { requireSync: true });
  filter = computed(() => readFilter(this.params()));
  q = signal('');
  list = computed(() => applyFilter(this.d().enrollments, { ...this.filter(), q: this.q() }));
  sum = computed(() => summarize(this.list(), this.d().N));
  employees = computed(() => new Set(this.list().map((e) => empKey(e.empId))).size);
  totalSub = computed(() => {
    const e = this.employees();
    const n = this.list().length;
    return `${fmtNum(e)} ${e === 1 ? 'employee' : 'employees'} · ${fmtNum(n)} ${n === 1 ? 'enrollment' : 'enrollments'}`;
  });
  orgs = computed(() => [...new Set(this.d().enrollments.map((e) => e.reportingOrg))].sort());
  bands = computed(() => [...new Set(this.d().enrollments.map((e) => e.band))].sort());

  /** Filter chips: HyperScaler (with its logo), status (in its status colour), everything else neutral. */
  chips = computed<Chip[]>(() => {
    const f = this.filter();
    const c: Chip[] = [];
    if (f.hs !== undefined) c.push({ label: `HyperScaler: ${f.hs}`, keys: ['hs'], kind: 'hs' });
    if (f.org !== undefined) c.push({ label: `Reporting Orgn: ${orNone(f.org)}`, keys: ['org'], kind: 'other' });
    if (f.band !== undefined) c.push({ label: `Band: ${orNone(f.band)}`, keys: ['band'], kind: 'other' });
    if (f.st) c.push({ label: `Status: ${STATUS_LABEL[f.st]}`, keys: ['st'], kind: 'status', st: f.st });
    if (f.lv) c.push({ label: `L${f.lv}: ${STATUS_LABEL[f.ls!]}`, keys: ['lv', 'ls'], kind: 'status', st: f.ls });
    if (f.hi !== undefined) c.push({ label: f.hi ? `Highest completed: L${f.hi}` : 'No level completed yet', keys: ['hi'], kind: 'other' });
    if (f.flag) c.push({ label: FLAGS[f.flag], keys: ['flag'], kind: 'other' });
    return c;
  });
  /** Heading = the HyperScaler (or the first other filter); status gets its own coloured badge; the rest is quiet context. */
  private context = computed(() => this.chips().filter((c) => c.kind === 'other').map((c) => c.label));
  heading = computed(() => this.filter().hs ?? this.context()[0] ?? 'All employees');
  contextLine = computed(() => (this.filter().hs !== undefined ? this.context() : this.context().slice(1)).join(' · '));
  crumbs = computed(() => {
    const hs = this.filter().hs;
    return [{ label: 'Overall', to: '/' }, ...(hs !== undefined ? [{ label: hs, to: hsUrl(hs) }] : []), { label: 'Employees' }];
  });

  /** Status card links: set that status, or remove it when it's already the active one. */
  statusLink = (k: St) => {
    const p = new URLSearchParams();
    const m = this.params();
    for (const key of m.keys) if (key !== 'snapshot' && key !== 'st') p.set(key, m.get(key)!);
    if (this.filter().st !== k) p.set('st', k);
    const s = p.toString();
    return s ? `/people?${s}` : '/people';
  };

  private navigate(mut: (p: Record<string, string | null>) => void) {
    const qp: Record<string, string | null> = {};
    mut(qp);
    void this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: 'merge' });
  }
  setParam(k: string, v: string) {
    this.navigate((p) => (p[k] = v === '__all' ? null : v));
  }
  remove(keys: string[]) {
    this.navigate((p) => keys.forEach((k) => (p[k] = null)));
  }
  exportCsv() {
    const id = this.data.snapshotId();
    const chips = this.chips();
    const name = `employees-${id ? dataMonth(id).replace(' ', '-') : 'data'}${chips.length ? '-' + chips.map((c) => c.label.replace(/[^A-Za-z0-9]+/g, '_')).join('-') : ''}.csv`.slice(0, 150);
    exportPeopleCsv(this.list(), this.d().N, name);
  }
}
