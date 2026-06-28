import type { UtilizationSummary } from "@/lib/types";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { buildUtilizationFromDataset } from "@/lib/google-sheets/utilization";

const aggregateCache = new Map<string, UtilizationSummary>();
const AGGREGATE_CACHE_MAX = 32;

function cacheKey(fetchedAt: number, from: Date, to: Date): string {
  return `${fetchedAt}|${from.toISOString()}|${to.toISOString()}`;
}

export function getUtilizationBundle(
  dataset: FleetDataset,
  from: Date,
  to: Date
): UtilizationSummary {
  const key = cacheKey(dataset.fetchedAt, from, to);
  const hit = aggregateCache.get(key);
  if (hit) return hit;

  const summary = buildUtilizationFromDataset(dataset, from, to);
  aggregateCache.set(key, summary);

  if (aggregateCache.size > AGGREGATE_CACHE_MAX) {
    const oldest = aggregateCache.keys().next().value;
    if (oldest) aggregateCache.delete(oldest);
  }

  return summary;
}

export function clearUtilizationAggregateCache(): void {
  aggregateCache.clear();
}
