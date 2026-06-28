import { getFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";
import { buildUnitLatestRows } from "@/lib/fleet/unit-latest";
import type { UnitLatestRow } from "@/lib/types";
import { getTelematicsSnapshot } from "@/lib/telematics/snapshot";

function latestRowByMachine(
  rows: ParsedKasuluFleetRow[]
): Map<string, ParsedKasuluFleetRow> {
  const latestByMachine = new Map<string, ParsedKasuluFleetRow>();
  for (const row of rows) {
    const prev = latestByMachine.get(row.machineId);
    if (!prev || row.date > prev.date) {
      latestByMachine.set(row.machineId, row);
    }
  }
  return latestByMachine;
}

/** Current asset locations — live telematics overlay on Google Sheets fleet register. */
export async function getLiveUnitLocations(
  from: Date,
  to: Date
): Promise<UnitLatestRow[]> {
  const sheetDataset = await getFleetDataset();
  const latestByMachine = latestRowByMachine(sheetDataset.rows);
  const telematics = await getTelematicsSnapshot(from, to);

  return buildUnitLatestRows(
    latestByMachine,
    sheetDataset.unitIds,
    telematics?.unitLatestSnapshots ?? []
  );
}
