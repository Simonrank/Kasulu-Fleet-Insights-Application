import type { DriverIncidentRow } from "@/lib/types";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(sorted.length * p))
  );
  return sorted[index];
}

function numericSeverity(
  value: number,
  sortedValues: number[]
): "critical" | "high" | "medium" | "low" {
  if (sortedValues.length === 0) return "medium";
  const p50 = percentile(sortedValues, 0.5);
  const p75 = percentile(sortedValues, 0.75);
  const p90 = percentile(sortedValues, 0.9);
  if (value >= p90) return "critical";
  if (value >= p75) return "high";
  if (value >= p50) return "medium";
  return "low";
}

/** Severity quartiles from numeric values present in the loaded batch. */
export function applyDatasetSeverity(
  rows: DriverIncidentRow[]
): DriverIncidentRow[] {
  const speedOver: number[] = [];
  const fuelVolumes: number[] = [];
  const allValues: number[] = [];

  for (const row of rows) {
    if (row.value == null || row.value <= 0) continue;
    allValues.push(row.value);
    if (row.threshold != null && row.threshold > 0 && row.value > row.threshold) {
      speedOver.push(row.value - row.threshold);
    }
    if (row.incidentType.includes("fuel") || row.incidentType.includes("theft")) {
      fuelVolumes.push(row.value);
    }
  }

  allValues.sort((a, b) => a - b);
  speedOver.sort((a, b) => a - b);
  fuelVolumes.sort((a, b) => a - b);

  return rows.map((row) => {
    if (row.value != null && row.value > 0) {
      if (
        row.threshold != null &&
        row.threshold > 0 &&
        row.value > row.threshold
      ) {
        return {
          ...row,
          severity: numericSeverity(row.value - row.threshold, speedOver),
        };
      }
      if (row.incidentType.includes("fuel") || row.incidentType.includes("theft")) {
        return {
          ...row,
          severity: numericSeverity(row.value, fuelVolumes),
        };
      }
      return { ...row, severity: numericSeverity(row.value, allValues) };
    }
    return { ...row, severity: "low" };
  });
}
