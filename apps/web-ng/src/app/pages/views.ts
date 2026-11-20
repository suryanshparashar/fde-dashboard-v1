import { Component, Input, OnChanges, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import type { Dataset, GroupRow, PeopleFilter, Summary } from '../lib/aggregate';
import { applyFilter, groupBy, subsetQuality, summarize } from '../lib/aggregate';
import { dataMonth, fmtNum, snapshotLabel } from '../lib/format';
import { peopleUrl } from '../lib/links';
import { isBaseHyperscaler, isKnownHyperscaler, shownHyperscalers } from '../lib/hyperscalers';
import { levelsFor } from '../lib/levelConfig';
import { DataService } from '../core/data.service';
import { SnapLinkDirective } from '../core/snap-link.directive';
import { BreadcrumbComponent, HsLogoComponent, HsTabsComponent, NewTagComponent, StepperComponent } from '../ui/basics';
import { HsCardsComponent, InsightCardsComponent, StatusCardsComponent } from '../ui/liquid';
import { BreakdownCardComponent, FunnelGlassesComponent, HighestCardComponent, LevelStatusCardComponent } from '../ui/fluid';
import { PeopleTableComponent } from '../ui/shell';

/** Loading / error / no-data states shared by the dashboard views. */
@Component({
  selector: 'app-gate',
  standalone: true,
  imports: [SnapLinkDirective],
  template: `
    @if (data.loading() && !data.snapshotId()) {
      <div class="page muted">Loading…</div>
    } @else if (data.error()) {
      <div class="page">
        <div class="empty big"><b>Couldn't load the data</b><span>{{ data.error() }}</span></div>
      </div>
    } @else if (!data.snapshotId() || !data.dataset().enrollments.length) {
      <div class="page">
        <div class="empty big">
          <span style="font-size: 28px">○</span>
          <b>No data yet</b>
          <span>Upload this month's sheet (Emp ID, Name, Reporting Orgn, Band, HyperScaler, ETA (Date), Certificate done/WIP, Certification Levels, Email ID).</span>
          <a snapLink="/upload" class="btn primary mt-2">Upload the monthly sheet →</a>
        </div>
      </div>
    } @else {
      <ng-content />
    }
  `,
})
export class GateComponent {
  data = inject(DataService);
}

/** Levels and breakdown, in the fluid design: the same for Overall and each HyperScaler. */
@Component({
  selector: 'app-levels-body',
  standalone: true,
  imports: [FunnelGlassesComponent, LevelStatusCardComponent, HighestCardComponent, BreakdownCardComponent],
  template: `
    <div class="sec">Levels</div>
    @if (d.N > 0) {
      <app-funnel-glasses [sum]="sum" [N]="d.N" [base]="base" [unit]="unit" />
      <div class="grid2">
        <app-level-status-card [sum]="sum" [N]="d.N" [base]="base" [unit]="unit" />
        <app-highest-card [sum]="sum" [N]="d.N" [base]="base" [unit]="unit" />
      </div>
    } @else {
      <div class="empty">
        <span style="font-size: 20px">○</span>
        <div><b>No Certification Levels in this file.</b> Every row has an empty level, so per-level status can't be shown.</div>
      </div>
    }
    <div class="sec">Breakdown</div>
    <app-breakdown-card [orgs]="orgs" [bands]="bands" [base]="base" [multi]="!base.hs" />
  `,
  host: { style: 'display:contents' },
})
export class LevelsBodyComponent implements OnChanges {
  @Input({ required: true }) d!: Dataset;
  @Input() base: PeopleFilter = {};
  @Input() unit = 'enrollments';
  sum!: Summary;
  orgs: GroupRow[] = [];
  bands: GroupRow[] = [];
  ngOnChanges() {
    const list = applyFilter(this.d.enrollments, this.base);
    this.sum = summarize(list, this.d.N);
    this.orgs = groupBy(list, 'reportingOrg');
    this.bands = groupBy(list, 'band');
  }
}

const OVERALL: PeopleFilter = {};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [GateComponent, HsTabsComponent, StatusCardsComponent, InsightCardsComponent, HsCardsComponent, LevelsBodyComponent],
  template: `
    <app-gate>
      @if (data.snapshotId(); as id) {
        <app-hs-tabs [dataset]="d()" [active]="null" />
        <div class="page stack">
          <div class="vhead">
            <h2>Overall</h2>
            <span class="meta">{{ month(id) }} data · uploaded {{ label(id) }} · {{ d().hyperscalers.length }} HyperScalers with data · {{ d().N }} levels · {{ fmt(d().rowCount) }} rows in the file</span>
          </div>
          <div class="sec">Status</div>
          <app-status-cards [sum]="d().summary" [base]="base" />
          <div class="sec">Key insights</div>
          <app-insight-cards [sum]="d().summary" [q]="d().quality" [base]="base" />
          <div class="sec">HyperScalers</div>
          <app-hs-cards [d]="d()" [monthLabel]="month(id)" />
          <app-levels-body [d]="d()" [base]="base" unit="enrollments" />
        </div>
      }
    </app-gate>
  `,
})
export class OverviewPage {
  data = inject(DataService);
  d = this.data.dataset;
  base = OVERALL;
  month = dataMonth;
  label = snapshotLabel;
  fmt = fmtNum;
}

@Component({
  selector: 'app-hyperscaler',
  standalone: true,
  imports: [
    GateComponent,
    SnapLinkDirective,
    HsTabsComponent,
    BreadcrumbComponent,
    HsLogoComponent,
    NewTagComponent,
    StepperComponent,
    StatusCardsComponent,
    InsightCardsComponent,
    LevelsBodyComponent,
    PeopleTableComponent,
  ],
  template: `
    <app-gate>
      @if (data.snapshotId(); as id) {
        <app-hs-tabs [dataset]="d()" [active]="name()" />
        <app-breadcrumb [parts]="crumbs()" />
        <div class="page stack" style="padding-bottom: 0">
          <div class="vhead">
            <app-hs-logo [name]="name()" [sm]="true" />
            <div>
              <h2>{{ name() }}<app-new-tag [name]="name()" /></h2>
              <span class="meta">{{ view() ? 'HyperScaler · ' + fmt(view()!.sum.total) + ' employees · ' + levels() + ' levels' : base() ? 'HyperScaler · no rows this month' : 'Not in this month’s data' }}</span>
            </div>
            @if (shown().includes(name())) {
              <app-stepper [list]="shown()" [current]="name()" />
            }
          </div>
        </div>
        @if (view(); as v) {
          <div class="page stack">
            <div class="sec" style="margin-top: 0">Status</div>
            <app-status-cards [sum]="v.sum" [base]="filter()" [parent]="d().summary" />
            <div class="sec">Key insights</div>
            <app-insight-cards [sum]="v.sum" [q]="v.quality" [base]="filter()" [parent]="d().summary" />
            <app-levels-body [d]="d()" [base]="filter()" unit="employees" />
            <div>
              <div class="flex items-end gap-3 mb-2.5">
                <div>
                  <div class="h2">Employees on {{ name() }}</div>
                  <div class="h2-sub">First 10 by Emp ID · Emp ID, Email ID and the status of every level</div>
                </div>
                <a [snapLink]="people(filter())" class="btn sm ghost ml-auto">Open the full list ({{ fmt(v.list.length) }}) ›</a>
              </div>
              <app-people-table [list]="v.list" [N]="d().N" [hideHs]="true" [limit]="10" />
            </div>
          </div>
        } @else {
          <div class="page">
            <div class="empty big">
              <span style="font-size: 28px">○</span>
              <b>{{ known() ? 'No ' + name() + ' rows in the ' + month(id) + ' file.' : name() + " isn't in this month's data." }}</b>
              <a snapLink="/" class="link">← Back to Overall</a>
            </div>
          </div>
        }
      }
    </app-gate>
  `,
})
export class HyperScalerPage {
  data = inject(DataService);
  private route = inject(ActivatedRoute);
  d = this.data.dataset;
  name = toSignal(this.route.paramMap.pipe(map((p) => p.get('name') ?? '')), { initialValue: '' });
  filter = computed<PeopleFilter>(() => ({ hs: this.name() }));
  crumbs = computed(() => [{ label: 'Overall', to: '/' }, { label: this.name() }]);
  shown = computed(() => shownHyperscalers(this.d().hyperscalers));
  base = computed(() => isBaseHyperscaler(this.name()));
  known = computed(() => isBaseHyperscaler(this.name()) || isKnownHyperscaler(this.name()));
  levels = computed(() => levelsFor(this.name()));
  view = computed(() => {
    const d = this.d();
    if (!d.hyperscalers.includes(this.name())) return null;
    const list = applyFilter(d.enrollments, this.filter());
    const sum = summarize(list, d.N);
    return { list, sum, quality: subsetQuality(list, sum, d.quality.profileConflicts) };
  });
  month = dataMonth;
  fmt = fmtNum;
  people = peopleUrl;
}
