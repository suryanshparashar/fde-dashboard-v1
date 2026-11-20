import { Component, DestroyRef, Directive, Input, OnChanges, OnInit, inject, signal, type Signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { St } from '../types';
import { STATUS_LABEL } from '../types';
import type { GroupRow, PeopleFilter, Summary } from '../lib/aggregate';
import { pct } from '../lib/aggregate';
import { levelRamp } from '../lib/levels';
import { fmtNum } from '../lib/format';
import { peopleUrl } from '../lib/links';
import { SnapLinkDirective } from '../core/snap-link.directive';
import { prefersReducedMotion, startFill } from '../core/fill';
import { LvlChipComponent, orNone } from './basics';
import { LabComponent, LiquidCardComponent, NumComponent, WAVE } from './liquid';

/* =============== shared: a horizontal tank that pours in once =============== */

export interface Seg {
  key: string;
  v: number;
  /** Status class for the colour, or a custom colour. */
  cls?: St | 'none';
  color?: string;
  ink?: string;
  /** Shown inside the segment when it is wide enough; `sub` adds a small second line. */
  label?: string;
  sub?: string;
  to?: string;
  title: string;
}

/** Fill progress that starts on init (base for the fluid cards). */
@Directive()
abstract class Fills implements OnInit {
  protected fillDelay = 150;
  protected fillDur = 1500;
  private destroyRef = inject(DestroyRef);
  e: Signal<number> = signal(prefersReducedMotion() ? 1 : 0);
  ngOnInit() {
    this.e = startFill(this.destroyRef, this.fillDelay, this.fillDur);
  }
}

/** Segments fill from left to right like a liquid, with a moving front, then stay still. */
@Component({
  selector: 'app-pour-bar',
  standalone: true,
  imports: [SnapLinkDirective, NgTemplateOutlet],
  template: `
    <div class="tank" [class.pouring]="e > 0 && e < 1" [style.height.px]="h" role="img" [attr.aria-label]="aria">
      <div class="pour" [style.clip-path]="clip">
        @for (s of visible; track s.key) {
          <ng-template #inner>
            @if (fits(s)) {
              @if (s.sub) {
                <span class="two"><b>{{ s.label }}</b><small>{{ s.sub }}</small></span>
              } @else {
                {{ s.label }}
              }
            }
          </ng-template>
          @if (s.to) {
            <a [snapLink]="s.to" class="seg {{ s.cls ?? '' }}" [style.flex]="s.v" [style.background]="s.color" [style.color]="s.ink" [title]="s.title + ' (open list)'"><ng-container *ngTemplateOutlet="inner" /></a>
          } @else {
            <span class="seg {{ s.cls ?? '' }}" [style.flex]="s.v" [style.background]="s.color" [style.color]="s.ink" [title]="s.title"><ng-container *ngTemplateOutlet="inner" /></span>
          }
        }
      </div>
      <div class="edge" [style.left.%]="pctFill">
        <svg viewBox="0 0 26 120" preserveAspectRatio="none" aria-hidden="true"><path d="M13 0 C 26 10, 0 20, 13 30 S 0 50, 13 60 S 26 80, 13 90 S 0 110, 13 120 H0 V0Z" /></svg>
      </div>
    </div>
  `,
  host: { style: 'display:contents' },
})
export class PourBarComponent {
  @Input({ required: true }) segs!: Seg[];
  @Input() e = 1;
  @Input() h = 34;
  @Input() minShare = 0.05;
  @Input() label = '';
  get total() {
    return this.segs.reduce((a, s) => a + s.v, 0);
  }
  get visible() {
    return this.segs.filter((s) => s.v > 0);
  }
  get pctFill() {
    return Math.max(0, Math.min(1, this.e)) * 100;
  }
  get clip() {
    return `inset(0 ${100 - this.pctFill}% 0 0)`;
  }
  get aria() {
    return `${this.label}: ${this.segs.map((s) => s.title).join(', ')}`;
  }
  fits(s: Seg) {
    return !!s.label && this.total > 0 && s.v / this.total >= this.minShare;
  }
}

const statusSegs = (s: Record<St, number>, to?: (k: St) => string, labels = true): Seg[] =>
  (['done', 'wip', 'ns'] as St[]).map((k) => ({ key: k, v: s[k], cls: k, label: labels ? fmtNum(s[k]) : undefined, to: to?.(k), title: `${STATUS_LABEL[k]}: ${fmtNum(s[k])}` }));

@Component({
  selector: 'app-card-head',
  standalone: true,
  template: `<div class="fl-head"><h3>{{ title }}</h3><span class="fl-i" [title]="tip" [attr.aria-label]="tip">i</span><ng-content /></div>`,
  host: { style: 'display:contents' },
})
export class CardHeadComponent {
  @Input({ required: true }) title!: string;
  @Input() tip = '';
}

const LEGEND = `<div class="fl-legend"><span><i class="dot done"></i>Completed</span><span><i class="dot wip"></i>In progress</span><span><i class="dot ns"></i>Not started</span></div>`;

/* =============== Levels: status per level =============== */

@Component({
  selector: 'app-level-status-card',
  standalone: true,
  imports: [CardHeadComponent, PourBarComponent, LvlChipComponent, SnapLinkDirective],
  template: `
    <div class="fl-card">
      <app-card-head title="Status per level" [tip]="tip" />
      ${LEGEND}
      <div class="fl-levels">
        @for (row of rows; track i; let i = $index) {
          <div class="fl-lvrow">
            <app-lvl-chip [lv]="i + 1" [N]="N" />
            <app-pour-bar [segs]="row.segs" [e]="Math.min(1, e() * 1.15 - i * 0.05)" [label]="'L' + (i + 1)" />
            <a class="fl-done" [snapLink]="row.done" [title]="'L' + (i + 1) + ' completed'">✓ {{ fmt(Math.round(row.v * e())) }}</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class LevelStatusCardComponent extends Fills implements OnChanges {
  @Input({ required: true }) sum!: Summary;
  @Input({ required: true }) N!: number;
  @Input() base: PeopleFilter = {};
  @Input() unit = 'enrollments';
  Math = Math;
  fmt = fmtNum;
  rows: { segs: Seg[]; done: string; v: number }[] = [];
  tip = '';
  ngOnChanges() {
    this.rows = this.sum.levels.map((l, i) => ({
      segs: statusSegs(l, (ls) => peopleUrl({ ...this.base, lv: i + 1, ls })),
      done: peopleUrl({ ...this.base, lv: i + 1, ls: 'done' }),
      v: l.done,
    }));
    this.tip = `Every level counts all ${fmtNum(this.sum.total)} ${this.unit}; a level with no row in the file counts as Not started. Click a segment for the list.`;
  }
}

/* =============== Levels: funnel as a row of glasses =============== */

interface Step {
  key: string;
  label: string;
  lv?: number;
  v: number;
  color: string;
  to?: string;
  share: number;
  conv: number | null;
  pill: string;
  kind: '' | 'worst' | 'over';
}

@Component({
  selector: 'app-funnel-glasses',
  standalone: true,
  imports: [CardHeadComponent, LvlChipComponent, SnapLinkDirective, NgTemplateOutlet],
  template: `
    <div class="fl-card">
      <app-card-head title="Level funnel" tip="Each glass is filled to its share of everyone; the pill between two glasses is the share that continues from the previous step." />
      <div class="glasses">
        @for (s of steps; track s.key; let i = $index) {
          <ng-template #glass>
            <div class="g-lab">
              @if (s.lv) {
                <app-lvl-chip [lv]="s.lv" [N]="N" /> ✓
              } @else {
                {{ s.label }}
              }
            </div>
            <div class="glass" [class.pouring]="e() > 0 && e() < 1">
              <div class="g-liq" [style.height.%]="Math.max(s.share * 100, s.v ? 3 : 0) * e()" [style.background]="s.color">
                <svg class="g-wave" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path [attr.d]="wave" [style.fill]="s.color" /></svg>
              </div>
            </div>
            <span class="bignum n33">{{ fmt(Math.round(s.v * e())) }}</span>
            <div class="g-sub">{{ pct(s.v, sum.total) }}% of all</div>
          </ng-template>
          @if (i > 0) {
            <div class="g-pill {{ s.kind }}" [title]="s.kind === 'over' ? 'More than the previous step: check the data' : s.kind === 'worst' ? 'Lowest conversion: the bottleneck' : 'Share that continues'">
              →&nbsp;{{ s.pill }}
              @if (s.kind) {
                <small>{{ s.kind === 'over' ? '⚠ more' : '⚠ bottleneck' }}</small>
              }
            </div>
          }
          @if (s.to) {
            <a [snapLink]="s.to" class="g-col"><ng-container *ngTemplateOutlet="glass" /></a>
          } @else {
            <div class="g-col"><ng-container *ngTemplateOutlet="glass" /></div>
          }
        }
      </div>
    </div>
  `,
})
export class FunnelGlassesComponent extends Fills implements OnChanges {
  @Input({ required: true }) sum!: Summary;
  @Input({ required: true }) N!: number;
  @Input() base: PeopleFilter = {};
  @Input() unit = 'enrollments';
  override fillDelay = 250;
  override fillDur = 1600;
  Math = Math;
  fmt = fmtNum;
  pct = pct;
  wave = WAVE;
  steps: Step[] = [];
  ngOnChanges() {
    const ramp = levelRamp(this.N);
    const t = this.sum.total;
    const raw = [
      { key: 'all', label: this.unit[0].toUpperCase() + this.unit.slice(1), v: t, color: '#cbd5e1', to: peopleUrl(this.base) as string | undefined, lv: undefined as number | undefined },
      { key: 'st', label: 'Started', v: this.sum.started, color: '#93c5fd', to: undefined, lv: undefined },
      ...this.sum.levels.map((l, i) => ({ key: `l${i}`, label: '', v: l.done, color: ramp[i].hex, to: peopleUrl({ ...this.base, lv: i + 1, ls: 'done' }), lv: i + 1 })),
    ];
    const conv = raw.map((s, i) => (i === 0 || !raw[i - 1].v ? null : s.v / raw[i - 1].v));
    let worst = -1;
    for (let i = 2; i < raw.length; i++) if (conv[i] !== null && conv[i]! <= 1 && (worst < 0 || conv[i]! < conv[worst]!)) worst = i;
    this.steps = raw.map((s, i) => ({
      ...s,
      share: t ? s.v / t : 0,
      conv: conv[i],
      pill: conv[i] === null ? '—' : `${pct(s.v, raw[i - 1].v, 0)}%`,
      kind: conv[i] !== null && conv[i]! > 1 ? 'over' : i === worst ? 'worst' : '',
    }));
  }
}

/* =============== Levels: highest level completed =============== */

@Component({
  selector: 'app-highest-card',
  standalone: true,
  imports: [CardHeadComponent, PourBarComponent, SnapLinkDirective],
  template: `
    <div class="fl-card">
      <app-card-head title="Highest level completed" [tip]="'Each ' + (unit === 'employees' ? 'employee' : 'enrollment') + ' is counted once, at the highest level they completed.'" />
      @if (sum.reached === 0) {
        <div class="fl-note"><b>No level completed yet.</b> {{ fmt(sum.s.wip) }} {{ unit }} are in progress.</div>
      }
      <app-pour-bar [segs]="segs" [e]="e()" [h]="55" [minShare]="0.045" label="Highest level completed" />
      <div class="fl-keys">
        @for (s of segs; track s.key; let idx = $index) {
          <a [snapLink]="s.to!" class="fl-key">
            <i [style.background]="s.color"></i>
            {{ idx === 0 ? 'No level yet' : 'L' + idx + ' highest' }}
            <b>{{ fmt(s.v) }}</b>
            <span>{{ pct(s.v, sum.total) }}%</span>
          </a>
        }
      </div>
    </div>
  `,
})
export class HighestCardComponent extends Fills implements OnChanges {
  @Input({ required: true }) sum!: Summary;
  @Input({ required: true }) N!: number;
  @Input() base: PeopleFilter = {};
  @Input() unit = 'enrollments';
  override fillDelay = 350;
  fmt = fmtNum;
  pct = pct;
  segs: Seg[] = [];
  ngOnChanges() {
    const ramp = levelRamp(this.N);
    const none = this.sum.highest.none;
    this.segs = [
      { key: 'none', v: none, cls: 'none', color: 'var(--none)', ink: '#334155', label: fmtNum(none), sub: 'No level yet', to: peopleUrl({ ...this.base, hi: 0 }), title: `No level completed yet: ${fmtNum(none)}` },
      ...this.sum.highest.byLevel.map((v, i) => ({
        key: `l${i}`,
        v,
        color: ramp[i].hex,
        ink: ramp[i].ink,
        label: fmtNum(v),
        sub: `L${i + 1}`,
        to: peopleUrl({ ...this.base, hi: i + 1 }),
        title: `Highest L${i + 1}: ${fmtNum(v)}`,
      })),
    ];
  }
}

/* =============== Breakdown: Reporting Orgn | Band =============== */

type SortKey = 'total' | 'started' | 'done';
interface BdRow {
  r: GroupRow;
  name: string;
  to: string;
  width: number;
  segs: Seg[];
  started: string;
}

@Component({
  selector: 'app-breakdown-card',
  standalone: true,
  imports: [CardHeadComponent, PourBarComponent, SnapLinkDirective],
  template: `
    <div class="fl-card">
      <app-card-head title="Breakdown" tip="Each row opens the employee list for that group.">
        <div class="fl-ctrls">
          <div class="seg-tg" role="tablist" aria-label="Group by">
            <button role="tab" [attr.aria-selected]="by === 'org'" [class.on]="by === 'org'" (click)="setBy('org')">Reporting Orgn · {{ orgs.length }}</button>
            <button role="tab" [attr.aria-selected]="by === 'band'" [class.on]="by === 'band'" (click)="setBy('band')">Band · {{ bands.length }}</button>
          </div>
          <label class="fl-sort">
            Sort
            <select class="sel" [value]="sort" (change)="setSort($any($event.target).value)">
              <option value="total">{{ multi ? 'Enrollments' : 'Employees' }}</option>
              <option value="started">% started</option>
              <option value="done">Completed</option>
            </select>
          </label>
        </div>
      </app-card-head>
      <div class="bd-rows">
        @for (x of shown; track x.name; let i = $index) {
          <a [snapLink]="x.to" class="bd-row" [class.other]="!x.r.name">
            <span class="bd-name">{{ x.name }}@if (multi) {<small>{{ fmt(x.r.employees) }} employees</small>}</span>
            <span class="bignum n26">{{ fmt(x.r.total) }}</span>
            <span class="bd-bar" [style.width.%]="x.width"><app-pour-bar [segs]="x.segs" [e]="Math.min(1, e() * 1.2 - i * 0.03)" [h]="13" [label]="x.name" /></span>
            <span class="bd-st">{{ x.started }}% started</span>
            <span class="bd-dn" [class.z]="!x.r.s.done">{{ x.r.s.done ? '✓ ' + fmt(x.r.s.done) : '—' }}</span>
            <span class="bd-chev" aria-hidden="true">›</span>
          </a>
        }
      </div>
      @if (count > LIMIT) {
        <button class="bd-more" (click)="toggleAll()">{{ all ? 'Show fewer ▴' : 'Show all ' + count + ' ▾' }}</button>
      }
    </div>
  `,
})
export class BreakdownCardComponent extends Fills implements OnChanges {
  @Input({ required: true }) orgs!: GroupRow[];
  @Input({ required: true }) bands!: GroupRow[];
  @Input() base: PeopleFilter = {};
  @Input() multi = true;
  override fillDelay = 200;
  override fillDur = 1300;
  readonly LIMIT = 8;
  Math = Math;
  fmt = fmtNum;
  by: 'org' | 'band' = 'org';
  sort: SortKey = 'total';
  all = false;
  count = 0;
  shown: BdRow[] = [];

  ngOnChanges() {
    this.recompute();
  }
  setBy(b: 'org' | 'band') {
    this.by = b;
    this.recompute();
  }
  setSort(s: SortKey) {
    this.sort = s;
    this.recompute();
  }
  toggleAll() {
    this.all = !this.all;
    this.recompute();
  }
  private recompute() {
    const rows = this.by === 'org' ? this.orgs : this.bands;
    const started = (g: GroupRow) => (g.total ? (g.s.done + g.s.wip) / g.total : 0);
    const cmp: Record<SortKey, (a: GroupRow, b: GroupRow) => number> = {
      total: (a, b) => b.total - a.total,
      started: (a, b) => started(b) - started(a),
      done: (a, b) => b.s.done - a.s.done,
    };
    const sorted = [...rows].sort((a, b) => (a.name === '' ? 1 : 0) - (b.name === '' ? 1 : 0) || cmp[this.sort](a, b) || a.name.localeCompare(b.name));
    const max = Math.max(1, ...rows.map((r) => r.total));
    this.count = sorted.length;
    this.shown = (this.all ? sorted : sorted.slice(0, this.LIMIT)).map((r) => ({
      r,
      name: orNone(r.name),
      to: peopleUrl(this.by === 'org' ? { ...this.base, org: r.name } : { ...this.base, band: r.name }),
      width: Math.max(8, (r.total / max) * 100),
      segs: statusSegs(r.s, undefined, false),
      started: pct(r.s.done + r.s.wip, r.total, 0),
    }));
  }
}

/* =============== compact liquid stat cards (Employees list, import summary) =============== */

@Component({
  selector: 'app-stat-row',
  standalone: true,
  imports: [LiquidCardComponent, NumComponent, LabComponent],
  template: `
    <div class="g4">
      <app-liquid-card #c0 [i]="0" [compact]="true">
        <app-lab>{{ totalLabel }}</app-lab>
        <app-num [value]="sum.total" [e]="c0.e()" cls="n42" />
        <div class="lq-sub">{{ totalSub }}</div>
      </app-liquid-card>
      @for (k of keys; track k; let i = $index) {
        <app-liquid-card
          #c
          [i]="i + 1"
          [compact]="true"
          [level]="share(k)"
          [tone]="k"
          [link]="to ? to(k) : undefined"
          [state]="active ? (active === k ? 'selected' : 'dim') : undefined"
          [corner]="active === k ? '✓ Filter on' : undefined"
        >
          <app-lab [dot]="k">{{ label[k] }}</app-lab>
          <app-num [value]="sum.s[k]" [e]="c.e()" cls="n42" />
          <div class="lq-sub">{{ pct(sum.s[k], sum.total) }}% of total</div>
        </app-liquid-card>
      }
    </div>
  `,
})
export class StatRowComponent {
  @Input({ required: true }) sum!: Summary;
  @Input() totalLabel = 'Total enrolled';
  @Input() totalSub = '';
  /** Link for each status card; omit to make them static. */
  @Input() to?: (k: St) => string;
  /** The status currently filtered on: its card is ringed, the others dim. */
  @Input() active?: St;
  keys: St[] = ['wip', 'done', 'ns'];
  label = STATUS_LABEL;
  pct = pct;
  share(k: St) {
    return this.sum.total ? (this.sum.s[k] / this.sum.total) * 100 : 0;
  }
}

/** Compact tile with a big number that counts up, e.g. "Rows saved". */
@Component({
  selector: 'app-number-tile',
  standalone: true,
  imports: [LiquidCardComponent, NumComponent, LabComponent],
  template: `
    <app-liquid-card #c [i]="i" [compact]="true">
      <app-lab>{{ label }}</app-lab>
      <app-num [value]="value" [e]="c.e()" cls="n42" />
      @if (sub) {
        <div class="lq-sub">{{ sub }}</div>
      }
    </app-liquid-card>
  `,
  host: { style: 'display:contents' },
})
export class NumberTileComponent {
  @Input() i = 0;
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input() sub?: string;
}
