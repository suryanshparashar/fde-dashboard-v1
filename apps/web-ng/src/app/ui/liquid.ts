import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, inject, signal, type Signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { St } from '../types';
import type { Counts, Dataset, PeopleFilter, Quality, Summary } from '../lib/aggregate';
import { increasingLevels, pct } from '../lib/aggregate';
import { fmtNum } from '../lib/format';
import { hsUrl, peopleUrl } from '../lib/links';
import { isKnownHyperscaler, shownHyperscalers } from '../lib/hyperscalers';
import { SnapLinkDirective } from '../core/snap-link.directive';
import { prefersReducedMotion, startFill } from '../core/fill';
import { DataQualityComponent, HsLogoComponent, StatusBarComponent } from './basics';

export const WAVE = 'M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V20 H0Z';
const p100 = (v: number, t: number) => (t ? (v / t) * 100 : 0);

/** Big number that counts up with the fill (equal-width digits only while counting). */
@Component({
  selector: 'app-num',
  standalone: true,
  template: `<span class="bignum {{ cls }}" [class.counting]="e < 1">{{ text }}</span>`,
  host: { style: 'display:contents' },
})
export class NumComponent {
  @Input({ required: true }) value!: number;
  @Input() e = 1;
  @Input() dec = 0;
  @Input() suffix = '';
  @Input() cls = 'n68';
  get text() {
    const v = this.value * this.e;
    return (this.dec ? v.toFixed(this.dec) : fmtNum(Math.round(v))) + this.suffix;
  }
}

/** Small-caps card label with an optional status dot. */
@Component({
  selector: 'app-lab',
  standalone: true,
  template: `<div class="lq-lab">@if (dot) {<i class="dot {{ dot }}"></i>}<ng-content /></div>`,
  host: { style: 'display:contents' },
})
export class LabComponent {
  @Input() dot?: St;
}

/** "▲ 1.8 pts vs Overall"; within 10% of the Overall value reads as the same. */
@Component({
  selector: 'app-compare',
  standalone: true,
  template: `
    @if (cls === 'eq') {
      <span class="cmpb eq">≈ same as Overall ({{ pv.toFixed(1) }}%)</span>
    } @else {
      <span class="cmpb {{ cls }}">{{ cls === 'up' ? '▲' : '▼' }} {{ abs }} pts vs Overall</span>
    }
  `,
  host: { style: 'display:contents' },
})
export class CompareComponent {
  @Input({ required: true }) v!: number;
  @Input({ required: true }) pv!: number;
  get cls() {
    const d = this.v - this.pv;
    return Math.abs(d) < Math.max(0.1, this.pv * 0.1) ? 'eq' : d > 0 ? 'up' : 'down';
  }
  get abs() {
    return Math.abs(this.v - this.pv).toFixed(1);
  }
}

/**
 * A card that fills like a glass to `level` % once on load, then stays still.
 * The liquid waves while the pointer (or focus) is on the card and freezes in place when it leaves.
 * Children read the fill progress via a template reference: <app-liquid-card #c> … c.e() …
 */
@Component({
  selector: 'app-liquid-card',
  standalone: true,
  imports: [SnapLinkDirective, NgTemplateOutlet],
  template: `
    <ng-template #body>
      @if (level !== undefined && tone) {
        <div class="liq {{ tone }}" [style.height.%]="Math.max(level, 4) * e()" aria-hidden="true">
          <svg class="wave" viewBox="0 0 200 20" preserveAspectRatio="none"><path [attr.d]="wave" /></svg>
          <svg class="wave w2" viewBox="0 0 200 20" preserveAspectRatio="none"><path [attr.d]="wave" /></svg>
        </div>
      }
      @if (tubes; as t) {
        <div class="tubes" aria-hidden="true">
          @for (k of tubeKeys; track k) {
            <div class="tube"><i class="{{ k }}" [style.height.%]="Math.max(share(t, k), 4) * e()"></i></div>
          }
        </div>
      }
      @if (corner) {
        <span class="lq-corner">{{ corner }}</span>
      }
      <div class="in"><ng-content /></div>
    </ng-template>
    @if (link) {
      <a [snapLink]="link" [class]="cls" (mouseenter)="hover(true)" (mouseleave)="hover(false)" (focus)="hover(true)" (blur)="hover(false)"><ng-container *ngTemplateOutlet="body" /></a>
    } @else if (clickable) {
      <button type="button" [class]="cls" (click)="act.emit()" (mouseenter)="hover(true)" (mouseleave)="hover(false)" (focus)="hover(true)" (blur)="hover(false)"><ng-container *ngTemplateOutlet="body" /></button>
    } @else {
      <div [class]="cls" (mouseenter)="hover(true)" (mouseleave)="hover(false)"><ng-container *ngTemplateOutlet="body" /></div>
    }
  `,
  host: { style: 'display:contents' },
})
export class LiquidCardComponent implements OnInit {
  @Input() i = 0;
  @Input() level?: number;
  @Input() tone?: string;
  @Input() link?: string;
  @Input() clickable = false;
  @Input() warn = false;
  @Input() bad = false;
  @Input() compact = false;
  @Input() state?: 'selected' | 'dim';
  @Input() corner?: string;
  /** Total-enrolled card: three mini tubes (Completed / In progress / Not started). */
  @Input() tubes?: Counts;
  @Output() act = new EventEmitter<void>();

  Math = Math;
  wave = WAVE;
  tubeKeys: St[] = ['done', 'wip', 'ns'];
  private destroyRef = inject(DestroyRef);
  e: Signal<number> = signal(prefersReducedMotion() ? 1 : 0);
  private hovered = signal(false);

  ngOnInit() {
    this.e = startFill(this.destroyRef, this.i * 110);
  }
  hover(on: boolean) {
    this.hovered.set(on && !prefersReducedMotion());
  }
  share(t: Counts, k: St) {
    return p100(t[k], t.done + t.wip + t.ns);
  }
  get cls() {
    const e = this.e();
    return ['lq', this.state ?? '', this.tone ?? '', this.compact ? 'sm' : '', this.warn ? 'warn' : '', this.bad ? 'bad' : '', (e > 0 && e < 1) || this.hovered() ? 'moving' : '']
      .filter(Boolean)
      .join(' ');
  }
}

const SHARED = [LiquidCardComponent, NumComponent, LabComponent, CompareComponent];

/* ---------------- status: 4 liquid cards ---------------- */

@Component({
  selector: 'app-status-cards',
  standalone: true,
  imports: [...SHARED],
  template: `
    <div class="g4">
      <app-liquid-card #c0 [i]="0" [link]="url(base)" [tubes]="sum.s">
        <app-lab>Total enrolled</app-lab>
        <app-num [value]="sum.total" [e]="c0.e()" />
        <div class="lq-sub">{{ totalSub }}</div>
      </app-liquid-card>
      @for (p of parts; track p.k; let idx = $index) {
        <app-liquid-card #c [i]="idx + 1" [level]="share(p.v)" [tone]="p.k" [link]="stLink(p.k)">
          <app-lab [dot]="p.k">{{ p.label }}</app-lab>
          <app-num [value]="p.v" [e]="c.e()" />
          <div class="lq-sub">{{ pct(p.v, sum.total) }}% of total{{ p.k === 'done' && sum.levels.length > 1 ? ' · all ' + sum.levels.length + ' levels' : '' }}</div>
          @if (parent && p.k === 'done') {
            <app-compare [v]="share(p.v)" [pv]="pshare(parent.s.done, parent.total)" />
          }
        </app-liquid-card>
      }
    </div>
  `,
})
export class StatusCardsComponent {
  @Input({ required: true }) sum!: Summary;
  @Input() base: PeopleFilter = {};
  @Input() parent?: Summary;
  url = peopleUrl;
  pct = pct;
  pshare = p100;
  get parts(): { k: St; label: string; v: number }[] {
    return [
      { k: 'wip', label: 'In progress', v: this.sum.s.wip },
      { k: 'done', label: 'Completed', v: this.sum.s.done },
      { k: 'ns', label: 'Not started', v: this.sum.s.ns },
    ];
  }
  stLink(k: St) {
    return peopleUrl({ ...this.base, st: k });
  }
  share(v: number) {
    return p100(v, this.sum.total);
  }
  get totalSub() {
    return this.parent ? `${pct(this.sum.total, this.parent.employees, 0)}% of all ${fmtNum(this.parent.employees)} employees` : `${fmtNum(this.sum.employees)} employees`;
  }
}

/* ---------------- key insights: 4 liquid cards + data checks ---------------- */

export function countChecks(q: Quality, withHs: boolean): number {
  return [withHs && q.addedHyperscalers.length, q.increasing.length, q.skipped, q.duplicateRows, q.emptyLevelRows, q.overRows, q.profileConflicts.length, q.noOrg, q.noBand, q.noEmail].filter(Boolean)
    .length;
}

@Component({
  selector: 'app-insight-cards',
  standalone: true,
  imports: [...SHARED, DataQualityComponent],
  template: `
    <div class="g4">
      <app-liquid-card #a [i]="4" [level]="share(sum.started)" tone="ind">
        <app-lab>Started</app-lab>
        <app-num [value]="share(sum.started)" [e]="a.e()" [dec]="1" suffix="%" cls="n53" />
        <div class="lq-sub">{{ fmt(sum.started) }} of {{ fmt(sum.total) }}</div>
        @if (parent) {
          <app-compare [v]="share(sum.started)" [pv]="pshare(parent.started, parent.total)" />
        }
      </app-liquid-card>
      <app-liquid-card #b [i]="5" [level]="share(sum.reached)" tone="ind">
        <app-lab>Reached L1+</app-lab>
        <app-num [value]="share(sum.reached)" [e]="b.e()" [dec]="1" suffix="%" cls="n53" />
        <div class="lq-sub">{{ fmt(sum.reached) }} completed a level</div>
        @if (parent) {
          <app-compare [v]="share(sum.reached)" [pv]="pshare(parent.reached, parent.total)" />
        }
      </app-liquid-card>
      @if (inc.length) {
        <app-liquid-card [i]="6" [bad]="true">
          <app-lab>Levels don't add up</app-lab>
          <span class="bignum n53" style="color: #991b1b">L{{ inc[0] }} &gt; L{{ inc[0] - 1 }} ⚠</span>
          <div class="lq-sub">{{ fmt(sum.levels[inc[0] - 1].done) }} vs {{ fmt(sum.levels[inc[0] - 2].done) }} completed</div>
        </app-liquid-card>
      } @else if (w > 0) {
        <app-liquid-card [i]="6" [level]="pshare(steps[w], steps[w - 1])" tone="amb" [warn]="true">
          <app-lab>Biggest drop</app-lab>
          <span class="bignum n53">{{ w === 1 ? 'Start → L1' : 'L' + (w - 1) + ' → L' + w }}</span>
          <div class="lq-sub">only <b>{{ pct(steps[w], steps[w - 1], 0) }}%</b> continue</div>
        </app-liquid-card>
      } @else {
        <app-liquid-card [i]="6">
          <app-lab>Biggest drop</app-lab>
          <span class="bignum n53 muted">—</span>
          <div class="lq-sub">no levels in this file</div>
        </app-liquid-card>
      }
      <app-liquid-card #d [i]="7" [warn]="checks > 0" [clickable]="true" (act)="open.set(!open())">
        <app-lab>Data checks</app-lab>
        @if (checks) {
          <app-num [value]="checks" [e]="d.e()" cls="n53" />
        } @else {
          <span class="bignum n53" style="color: var(--done)">✓</span>
        }
        <div class="lq-sub"><b>{{ checks ? 'to review' : 'all passed' }} {{ open() ? '▴' : '▾' }}</b></div>
      </app-liquid-card>
    </div>
    @if (open()) {
      <app-data-quality [q]="q" [sum]="sum" [base]="base" [scope]="base.hs" />
    }
  `,
  host: { style: 'display:contents' },
})
export class InsightCardsComponent {
  @Input({ required: true }) sum!: Summary;
  @Input({ required: true }) q!: Quality;
  @Input() base: PeopleFilter = {};
  @Input() parent?: Summary;
  open = signal(false);
  fmt = fmtNum;
  pct = pct;
  pshare = p100;
  share(v: number) {
    return p100(v, this.sum.total);
  }
  get steps() {
    return [this.sum.started, ...this.sum.levels.map((l) => l.done)];
  }
  /** Index of the step with the lowest conversion from the previous one. */
  get w() {
    const s = this.steps;
    let w = -1;
    for (let i = 1; i < s.length; i++) if (s[i - 1] && (w < 0 || s[i] / s[i - 1] < s[w] / s[w - 1])) w = i;
    return w;
  }
  get inc() {
    return increasingLevels(this.sum);
  }
  get checks() {
    return countChecks(this.q, !this.base.hs);
  }
}

/* ---------------- HyperScaler cards ---------------- */

interface HsRow {
  name: string;
  total: number;
  s: Counts;
}

/** The 4 base HyperScalers always; others only when this month's file has rows for them. */
@Component({
  selector: 'app-hs-cards',
  standalone: true,
  imports: [SnapLinkDirective, HsLogoComponent, StatusBarComponent],
  template: `
    <div class="hsq">
      @for (r of rows; track r.name) {
        @if (!r.total) {
          <div class="sq empty">
            <app-hs-logo [name]="r.name" />
            <div class="nm">{{ r.name }}<span class="tag-nod">no data</span></div>
            <div class="ct"><span class="bignum n42">0</span><small>employees</small></div>
            <div class="sbar"></div>
            <div class="dn z">No rows in the {{ monthLabel }} file</div>
            <div class="go" style="color: var(--muted)">—</div>
          </div>
        } @else {
          <a [snapLink]="url(r.name)" class="sq">
            <app-hs-logo [name]="r.name" />
            <div class="nm">{{ r.name }}@if (!known(r.name)) {<span class="tag-new" title="Not one of the known HyperScalers: added automatically from the uploaded file">new</span>}</div>
            <div class="ct"><span class="bignum n42">{{ fmt(r.total) }}</span><small>employees</small></div>
            <app-status-bar [s]="r.s" [label]="r.name" />
            <div class="dn" [class.z]="!r.s.done">{{ r.s.done ? '✓ ' + fmt(r.s.done) + ' completed' : 'none completed yet' }}</div>
            <div class="go">View details →</div>
          </a>
        }
      }
    </div>
  `,
})
export class HsCardsComponent implements OnChanges {
  @Input({ required: true }) d!: Dataset;
  @Input() monthLabel = '';
  fmt = fmtNum;
  url = hsUrl;
  known = isKnownHyperscaler;
  rows: HsRow[] = [];
  ngOnChanges() {
    const m = new Map<string, HsRow>();
    for (const e of this.d.enrollments) {
      let r = m.get(e.hyperscaler);
      if (!r) m.set(e.hyperscaler, (r = { name: e.hyperscaler, total: 0, s: { done: 0, wip: 0, ns: 0 } }));
      r.total++;
      r.s[e.status]++;
    }
    this.rows = shownHyperscalers(m.keys()).map((n) => m.get(n) ?? { name: n, total: 0, s: { done: 0, wip: 0, ns: 0 } });
  }
}
