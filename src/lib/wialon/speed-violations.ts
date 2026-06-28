import { isWialonReportConfigured } from "@/lib/config/env";
import {
  getWialonFleetDataset,
  invalidateWialonFleetDatasetCache,
} from "@/lib/wialon/fleet-dataset";
import type { ParsedSpeedingRow } from "@/lib/wialon/parse-report";

/** Speeding violations from Wialon "Speedings" report — reuses the shared fleet dataset cache. */
export async function getSpeedViolations(
  from: Date,
  to: Date
): Promise<ParsedSpeedingRow[]> {
  if (!isWialonReportConfigured()) return [];

  const dataset = await getWialonFleetDataset(from, to);
  return dataset.speedViolations ?? [];
}

export function invalidateSpeedViolationsCache(): void {
  invalidateWialonFleetDatasetCache();
}
