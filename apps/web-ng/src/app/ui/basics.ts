import { Component, Input, inject } from '@angular/core';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { Counts, Dataset, PeopleFilter, Quality, Summary } from '../lib/aggregate';
import { increasingLevels, pct } from '../lib/aggregate';
import { levelRamp } from '../lib/levels';
import { dataMonth as dataMonthOf, fmtNum, snapshotLabel as snapshotLabelOf } from '../lib/format';
import { hsUrl, peopleUrl } from '../lib/links';
import { HS_LOGOS, HS_TILES } from '../lib/logos';
import { hsMonogram, isKnownHyperscaler, shownHyperscalers } from '../lib/hyperscalers';
import { SnapLinkDirective } from '../core/snap-link.directive';
import { DataService } from '../core/data.service';

export const STS: St[] = ['done', 'wip', 'ns'];
export const orNone = (v: string) => v || 'Not given';
export { fmtNum, pct };

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
export class IconComponent {
  @Input({ required: true }) name!: 'upload' | 'search' | 'history' | 'download' | 'file';
}

/* ---------------- small pieces ---------------- */

/** Brand logo tile (Simple Icons) or a lettered tile when there is no icon. */
@Component({
  selector: 'app-hs-logo',
  standalone: true,
  template: `
    <span class="hs-logo" [class.sm]="sm" [style.--b]="color" aria-hidden="true">
      @if (logo; as l) {
        <svg viewBox="0 0 24 24">
          @for (d of l.paths; track $index) {
            <path [attr.d]="d" />
          }
        </svg>
      } @else {
        <span class="mono">{{ tileText }}</span>
      }
    </span>
  `,
  host: { style: 'display:contents' },
})
export class HsLogoComponent {
  @Input({ required: true }) name!: string;
  @Input() sm = false;
  get logo() {
    return HS_LOGOS[this.name];
  }
  get color() {
    return this.logo?.color ?? HS_TILES[this.name]?.color ?? '#1e3a8a';
  }
  get tileText() {
    return HS_TILES[this.name]?.text ?? hsMonogram(this.name);
  }
}

@Component({
  selector: 'app-lvl-chip',
  standalone: true,
  template: `<span class="lvl" [style.background]="c.hex" [style.color]="c.ink">L{{ lv }}</span>`,
  host: { style: 'display:contents' },
})
export class LvlChipComponent {
  @Input({ required: true }) lv!: number;
  @Input({ required: true }) N!: number;
  get c() {
    return levelRamp(Math.max(this.N, this.lv))[this.lv - 1];
  }
}

@Component({
  selector: 'app-new-tag',
  standalone: true,
  template: `@if (!known) {
    <span class="tag-new" title="Not one of the 7 known HyperScalers: added automatically from the uploaded file">added from file</span>
  }`,
  host: { style: 'display:contents' },
})
export class NewTagComponent {
  @Input({ required: true }) name!: string;
  get known() {
    return isKnownHyperscaler(this.name);
  }
}

/** 100% bar: Completed | In progress | Not started. Segments link to the matching employee list when `to` is given. */
@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [SnapLinkDirective],
  template: `
    @if (!total) {
      <div class="sbar empty-bar" [class.big]="big" aria-label="No data"></div>
    } @else {
      <div class="sbar" [class.big]="big" role="img" [attr.aria-label]="aria">
        @for (k of sts; track k) {
          @if (s[k]) {
            @if (to) {
              <a [snapLink]="to(k)" [class]="k" [style.flex]="s[k]" [title]="tip(k) + ' (open list)'"></a>
            } @else {
              <i [class]="k" [style.flex]="s[k]" [title]="tip(k)"></i>
            }
          }
        }
      </div>
    }
  `,
  host: { style: 'display:contents' },
})
export class StatusBarComponent {
  @Input({ required: true }) s!: Counts;
  @Input() big = false;
  @Input() to?: (st: St) => string;
  @Input() label = '';
  sts = STS;
  get total() {
    return this.s.done + this.s.wip + this.s.ns;
  }
  get aria() {
    return `${this.label ? `${this.label}: ` : ''}${STS.map((k) => `${STATUS_LABEL[k]} ${this.s[k]}`).join(', ')}`;
  }
  tip(k: St) {
    return `${STATUS_LABEL[k]}: ${fmtNum(this.s[k])} · ${pct(this.s[k], this.total)}%`;
  }
}

/* ---------------- navigation ---------------- */

export interface Crumb {
  label: string;
  to?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [SnapLinkDirective],
  template: `
    <nav class="bc" aria-label="Breadcrumb">
      @for (p of parts; track $index; let last = $last) {
        @if (!last) {
          <a [snapLink]="p.to ?? '/'">{{ p.label }}</a><span class="sep">›</span>
        } @else {
          <b aria-current="page">{{ p.label }}</b>
        }
      }
    </nav>
  `,
})
export class BreadcrumbComponent {
  @Input({ required: true }) parts!: Crumb[];
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [SnapLinkDirective],
  template: `
    <div class="stepper">
      @if (prev; as p) {
        <a [snapLink]="url(p)">‹ {{ p }}</a>
      } @else {
        <span class="dis">‹ Prev</span>
      }
      <b>{{ i + 1 }} of {{ list.length }}</b>
      @if (next; as n) {
        <a [snapLink]="url(n)">{{ n }} ›</a>
      } @else {
        <span class="dis">Next ›</span>
      }
    </div>
  `,
  host: { style: 'margin-left:auto' },
})
export class StepperComponent {
  @Input({ required: true }) list!: string[];
  @Input({ required: true }) current!: string;
  url = hsUrl;
  get i() {
    return this.list.indexOf(this.current);
  }
  get prev() {
    return this.i > 0 ? this.list[this.i - 1] : null;
  }
  get next() {
    return this.i >= 0 && this.i < this.list.length - 1 ? this.list[this.i + 1] : null;
  }
}

/** HyperScaler tabs under the header: Overall + one per HyperScaler (the 4 base ones always). */
@Component({
  selector: 'app-hs-tabs',
  standalone: true,
  imports: [SnapLinkDirective, HsLogoComponent],
  template: `
    <nav class="subtabs" aria-label="HyperScaler views">
      <a snapLink="/" [class.on]="active === null"><b>Overall</b> <small>{{ fmt(dataset.summary.employees) }} employees</small></a>
      @for (h of shown; track h) {
        <a [snapLink]="url(h)" [class.on]="active === h"><app-hs-logo [name]="h" [sm]="true" /><b>{{ h }}</b> <small>{{ fmt(counts.get(h) ?? 0) }}</small></a>
      }
    </nav>
  `,
})
export class HsTabsComponent {
  @Input({ required: true }) dataset!: Dataset;
  @Input() active: string | null = null;
  fmt = fmtNum;
  url = hsUrl;
  get shown() {
    return shownHyperscalers(this.dataset.hyperscalers);
  }
  get counts() {
    const m = new Map<string, number>();
    for (const e of this.dataset.enrollments) m.set(e.hyperscaler, (m.get(e.hyperscaler) ?? 0) + 1);
    return m;
  }
}

/* ---------------- data quality ---------------- */

/** One line of a data-check item: plain text, bold text, or a link. */
export interface Part {
  t: string;
  b?: boolean;
  to?: string;
}

const n = (v: number, one: string, many = one + 's') => `${fmtNum(v)} ${v === 1 ? one : many}`;

export function qualityItems(q: Quality, sum: Summary, base: PeopleFilter): Part[][] {
  const inc = increasingLevels(sum);
  const items: Part[][] = [];
  if (q.addedHyperscalers.length && !base.hs)
    items.push([
      { t: q.addedHyperscalers.join(', '), b: true },
      {
        t: ` ${q.addedHyperscalers.length > 1 ? 'are' : 'is'} not one of the 7 known HyperScalers (Anthropic, Azure, AWS, Google, GitHub, Red Hat OpenShift, Red Hat Ansible Automation) and was added automatically from the file.`,
      },
    ]);
  if (inc.length) items.push([{ t: `Completed counts go up at ${inc.map((l) => `L${l}`).join(', ')} (L1 ≥ L2 ≥ … expected, since levels are cumulative).` }]);
  if (q.skipped)
    items.push([{ t: n(q.skipped, 'enrollment'), to: peopleUrl({ ...base, flag: 'skip' }) }, { t: ` ${q.skipped === 1 ? 'has' : 'have'} a level completed while a lower level isn't.` }]);
  if (q.duplicateRows)
    items.push([
      { t: n(q.duplicateRows, 'row'), b: true },
      { t: ` ${q.duplicateRows === 1 ? 'repeats' : 'repeat'} the same employee × HyperScaler × level (in ` },
      { t: n(q.duplicateEnrollments, 'enrollment'), to: peopleUrl({ ...base, flag: 'dup' }) },
      { t: '). The furthest status was kept.' },
    ]);
  if (q.overRows)
    items.push([
      { t: n(q.overRows, 'row'), b: true },
      { t: ` ${q.overRows === 1 ? 'is' : 'are'} above its HyperScaler's levels (e.g. L5 when it has 4) and ${q.overRows === 1 ? 'is' : 'are'} not counted (` },
      { t: n(q.overEnrollments, 'enrollment'), to: peopleUrl({ ...base, flag: 'over' }) },
      { t: '). Level counts are set in levelConfig.ts.' },
    ]);
  if (q.emptyLevelRows)
    items.push([
      { t: n(q.emptyLevelRows, 'row'), b: true },
      { t: ` ${q.emptyLevelRows === 1 ? 'has' : 'have'} an empty Certification Level (` },
      { t: 'see enrollments', to: peopleUrl({ ...base, flag: 'nolevel' }) },
      { t: '): they count as enrollments but not in any level.' },
    ]);
  if (q.profileConflicts.length)
    items.push([
      { t: n(new Set(q.profileConflicts.map((c) => c.empId)).size, 'employee'), b: true },
      {
        t: ` with different values across their rows (e.g. ${q.profileConflicts
          .slice(0, 2)
          .map((c) => `${c.empId} ${c.field}: ${c.values.join(' / ')}`)
          .join('; ')}). The first value is used.`,
      },
    ]);
  if (q.noOrg) items.push([{ t: n(q.noOrg, 'employee'), b: true }, { t: ' without a Reporting Orgn (shown as "Not given").' }]);
  if (q.noBand) items.push([{ t: n(q.noBand, 'employee'), b: true }, { t: ' without a Band (shown as "Not given").' }]);
  if (q.noEmail) items.push([{ t: n(q.noEmail, 'employee'), b: true }, { t: ' without an Email ID.' }]);
  return items;
}

@Component({
  selector: 'app-data-quality',
  standalone: true,
  imports: [SnapLinkDirective],
  template: `
    @if (!items.length) {
      <div class="dq ok">
        <div class="h2">✓ Data checks passed{{ scope ? ' for ' + scope : '' }}</div>
        <div class="h2-sub" style="color: #166534">Levels are cumulative (L1 ≥ L2 ≥ …), no duplicate rows, no skipped levels, and every employee has an Org, Band and Email ID.</div>
      </div>
    } @else {
      <div class="dq">
        <div class="h2">⚠ Data checks{{ scope ? ': ' + scope : '' }}</div>
        <ul style="margin-top: 6px">
          @for (it of items; track $index) {
            <li>
              @for (p of it; track $index) {
                @if (p.to) {
                  <a [snapLink]="p.to">{{ p.t }}</a>
                } @else if (p.b) {
                  <b>{{ p.t }}</b>
                } @else {
                  {{ p.t }}
                }
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class DataQualityComponent {
  @Input({ required: true }) q!: Quality;
  @Input({ required: true }) sum!: Summary;
  @Input() base: PeopleFilter = {};
  @Input() scope?: string;
  get items() {
    return qualityItems(this.q, this.sum, this.base);
  }
}

/** Past-month banner under the header. */
@Component({
  selector: 'app-past-banner',
  standalone: true,
  template: `
    @if (data.isPast() && data.snapshotId(); as id) {
      <div class="banner-past" role="status">
        <div class="max-w-[1480px] mx-auto px-10 py-2.5 flex items-center gap-3 text-[13.5px]">
          <span aria-hidden="true">🕓</span>
          <span>You're viewing <b>{{ month(id) }}</b> data (uploaded {{ label(id) }}). It's read-only, and uploading is off until you go back to the latest data.</span>
          <button class="btn sm ghost ml-auto" (click)="data.setSnapshot(null)">Back to latest →</button>
        </div>
      </div>
    }
  `,
})
export class PastBannerComponent {
  data = inject(DataService);
  month = (id: string) => dataMonthOf(id);
  label = (id: string) => snapshotLabelOf(id);
}

