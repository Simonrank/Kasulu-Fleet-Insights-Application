import type { DashboardBundle } from "@/lib/types";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { buildDashboardFromSheet } from "@/lib/google-sheets/dashboard-analytics";

const aggregateCache = new Map<string, DashboardBundle>();
const AGGREGATE_CACHE_MAX = 32;

function aggregateCacheKey(
  fetchedAt: number,
  from: Date,
  to: Date
): string {
  return `${fetchedAt}|${from.toISOString()}|${to.toISOString()}`;
}

export function getDashboardBundle(
  dataset: FleetDataset,
  from: Date,
  to: Date
): DashboardBundle {
  const key = aggregateCacheKey(dataset.fetchedAt, from, to);
  const hit = aggregateCache.get(key);
  if (hit) return hit;

  const bundle = buildDashboardFromSheet(dataset, from, to);
  aggregateCache.set(key, bundle);

  if (aggregateCache.size > AGGREGATE_CACHE_MAX) {
    const oldest = aggregateCache.keys().next().value;
    if (oldest) aggregateCache.delete(oldest);
  }

  return bundle;
}

export function clearDashboardAggregateCache(): void {
  aggregateCache.clear();
}
