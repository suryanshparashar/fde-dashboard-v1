import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchSnapshot, listSnapshots } from '../lib/api';
import { buildDataset } from '../lib/aggregate';
import { isSnapshotId } from '../lib/snapshotName';

/** Selected snapshot from ?snapshot=…; null means "latest". */
export function useSnapshotParam() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('snapshot');
  const id = raw && isSnapshotId(raw) ? raw : null;
  const setSnapshot = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('snapshot', next);
    else p.delete('snapshot');
    setParams(p);
  };
  return { id, setSnapshot };
}

export function useSnapshots() {
  return useQuery({ queryKey: ['snapshots'], queryFn: listSnapshots });
}

/** The aggregated data of the selected month (or the latest upload). */
export function useData() {
  const { id } = useSnapshotParam();
  const snapshots = useSnapshots();
  const query = useQuery({ queryKey: ['snapshot', id ?? 'latest'], queryFn: () => fetchSnapshot(id ?? 'latest') });
  const dataset = useMemo(() => buildDataset(query.data?.rows ?? []), [query.data]);
  const latestId = snapshots.data?.[0]?.id ?? null;
  return {
    dataset,
    snapshotId: query.data?.id ?? null,
    latestId,
    /** True when viewing an older snapshot (read-only). */
    isPast: id !== null && latestId !== null && id !== latestId,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    snapshots: snapshots.data ?? [],
  };
}

/** Rows of one snapshot (not the selected one). */
export function useSnapshotRows(id: string | null) {
  return useQuery({
    queryKey: ['snapshot', id ?? 'none'],
    queryFn: () => fetchSnapshot(id!),
    enabled: Boolean(id),
  });
}
