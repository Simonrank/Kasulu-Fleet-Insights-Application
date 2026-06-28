import { isTelematicsConfigured } from "@/lib/config/env";
import { getWialonFleetDataset, prefetchWialonFleetDataset } from "@/lib/wialon/fleet-dataset";
import type { ParsedSpeedingRow, ParsedWialonViolationRow, ParsedUnitLatestRow } from "@/lib/wialon/parse-report";

export type TelematicsSnapshot = {
  speedViolations: ParsedSpeedingRow[];
  violations: ParsedWialonViolationRow[];
  unitLatestSnapshots: ParsedUnitLatestRow[];
  unitIds: Map<string, string>;
  fetchedAt: number;
};

/** Live telematics report data (speedings, violations, unit locations). */
export async function getTelematicsSnapshot(
  from: Date,
  to: Date
): Promise<TelematicsSnapshot | null> {
  if (!isTelematicsConfigured()) return null;

  const dataset = await getWialonFleetDataset(from, to);
  return {
    speedViolations: dataset.speedViolations ?? [],
    violations: dataset.wialonViolations ?? [],
    unitLatestSnapshots: dataset.unitLatestSnapshots ?? [],
    unitIds: dataset.unitIds,
    fetchedAt: dataset.fetchedAt,
  };
}

export function prefetchTelematicsSnapshot(from: Date, to: Date): void {
  if (!isTelematicsConfigured()) return;
  prefetchWialonFleetDataset(from, to);
}
