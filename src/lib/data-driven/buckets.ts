import { formatNumber } from "@/lib/utils";

/** Group numeric values into histogram buckets derived from the dataset range. */
export function buildNaturalBuckets(
  values: number[],
  maxBuckets = 5
): Array<{ label: string; min: number; max: number; count: number }> {
  const filtered = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (filtered.length === 0) return [];

  const sorted = [...filtered].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (min === max) {
    return [
      {
        label: `${formatNumber(min, 1)} km`,
        min,
        max,
        count: filtered.length,
      },
    ];
  }

  const bucketCount = Math.min(
    maxBuckets,
    Math.max(2, Math.ceil(Math.sqrt(filtered.length)))
  );
  const width = (max - min) / bucketCount;
  const buckets: Array<{ label: string; min: number; max: number; count: number }> =
    [];

  for (let i = 0; i < bucketCount; i++) {
    const lo = min + width * i;
    const hi = i === bucketCount - 1 ? max : min + width * (i + 1);
    const count = filtered.filter((v) =>
      i === bucketCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi
    ).length;
    buckets.push({
      label: `${formatNumber(lo, 0)}–${formatNumber(hi, 0)} km`,
      min: lo,
      max: hi,
      count,
    });
  }

  return buckets;
}
