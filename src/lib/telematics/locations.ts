import { isMobileStatusConfigured } from "@/lib/config/env";
import { getFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { latestRowByMachineDate } from "@/lib/google-sheets/latest-by-machine";
import { buildUnitLatestRows } from "@/lib/fleet/unit-latest";
import type { UnitLatestRow } from "@/lib/types";
import { getMobileStatusRows } from "@/lib/wialon/mobile-status";
import { getTelematicsSnapshot } from "@/lib/telematics/snapshot";

/** Live asset locations — Wialon Current Mobile Status when configured. */
export async function getLiveUnitLocations(
  from?: Date,
  to?: Date
): Promise<UnitLatestRow[]> {
  if (isMobileStatusConfigured()) {
    return getMobileStatusRows();
  }

  if (!from || !to) {
    return [];
  }

  const sheetDataset = await getFleetDataset();
  const latestByMachine = latestRowByMachineDate(sheetDataset.rows);
  const telematics = await getTelematicsSnapshot(from, to);

  return buildUnitLatestRows(
    latestByMachine,
    sheetDataset.unitIds,
    telematics?.unitLatestSnapshots ?? []
  );
}
