import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { DataRow, SnapshotInfo } from '../types';
import { fetchSnapshot, listSnapshots, type LoadedSnapshot } from '../lib/api';
import { buildDataset } from '../lib/aggregate';
import { isSnapshotId } from '../lib/snapshotName';

/**
 * App-wide data: the list of monthly uploads and the aggregated data of the selected month.
 * The month comes from ?snapshot=… in the URL (none = the latest upload).
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private router = inject(Router);

  /** Selected snapshot id from the URL, or null for "latest". */
  readonly param = signal<string | null>(null);
  readonly snapshots = signal<SnapshotInfo[]>([]);
  private readonly loaded = signal<LoadedSnapshot | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private cache = new Map<string, LoadedSnapshot>();

  readonly rows = computed<DataRow[]>(() => this.loaded()?.rows ?? []);
  readonly dataset = computed(() => buildDataset(this.rows()));
  readonly snapshotId = computed(() => this.loaded()?.id ?? null);
  readonly latestId = computed(() => this.snapshots()[0]?.id ?? null);
  /** True when viewing an older month (read-only). */
  readonly isPast = computed(() => {
    const p = this.param();
    const l = this.latestId();
    return p !== null && l !== null && p !== l;
  });

  constructor() {
    const read = () => {
      const raw = this.router.parseUrl(this.router.url).queryParamMap.get('snapshot');
      this.param.set(raw && isSnapshotId(raw) ? raw : null);
    };
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(read);
    read();
    void this.refreshList();
    effect(() => void this.load(this.param() ?? 'latest'), { allowSignalWrites: true });
  }

  async refreshList(): Promise<void> {
    try {
      this.snapshots.set(await listSnapshots());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  private async load(id: string): Promise<void> {
    const hit = this.cache.get(id);
    if (hit) {
      this.loaded.set(hit);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const snap = await fetchSnapshot(id);
      this.cache.set(id, snap);
      if ((this.param() ?? 'latest') === id) this.loaded.set(snap);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Rows of any one snapshot (import summary). */
  async snapshot(id: string): Promise<LoadedSnapshot> {
    const hit = this.cache.get(id);
    if (hit) return hit;
    const snap = await fetchSnapshot(id);
    this.cache.set(id, snap);
    return snap;
  }

  /** After a new upload: forget "latest" and reload. */
  async afterUpload(): Promise<void> {
    this.cache.delete('latest');
    await this.refreshList();
    if (this.param() === null) await this.load('latest');
  }

  /** Switch the whole app to another month (null = latest). */
  setSnapshot(id: string | null): void {
    void this.router.navigate([], { queryParams: { snapshot: id }, queryParamsHandling: 'merge' });
  }
}

/** Adds ?snapshot=… to an app URL so a past month stays selected while navigating. */
export function withSnapshot(url: string, snap: string | null): string {
  if (!snap) return url;
  return `${url}${url.includes('?') ? '&' : '?'}snapshot=${encodeURIComponent(snap)}`;
}
