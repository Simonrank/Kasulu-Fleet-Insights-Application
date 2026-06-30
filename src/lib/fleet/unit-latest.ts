import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";
import type { ParsedUnitLatestRow } from "@/lib/wialon/parse-report";
import type { UnitLatestRow } from "@/lib/types";

function resolveUnitId(
  machineId: string,
  unitIds: Map<string, string>
): string {
  return unitIds.get(machineId) ?? machineId;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildUnitLatestRows(
  latestByMachine: Map<string, ParsedKasuluFleetRow>,
  unitIds: Map<string, string>,
  wialonLatest: ParsedUnitLatestRow[] = []
): UnitLatestRow[] {
  const wialonByName = new Map(
    wialonLatest.map((row) => [normalizeKey(row.machineId), row])
  );

  const rows: UnitLatestRow[] = [];

  for (const [machineId, latest] of latestByMachine) {
    const wialon =
      wialonByName.get(normalizeKey(machineId)) ??
      [...wialonByName.values()].find(
        (row) =>
          normalizeKey(row.reg) === normalizeKey(machineId.split("—")[0] ?? "")
      );

    const reg = machineId.split("—")[0]?.trim() ?? machineId;
    const lastMessageAt = wialon?.lastMessageAt ?? null;

    rows.push({
      unitId: resolveUnitId(machineId, unitIds),
      reg: wialon?.reg ?? reg,
      name: machineId,
      lastMessageAt: lastMessageAt?.toISOString() ?? null,
      locationLabel: wialon?.locationLabel ?? null,
      lat: wialon?.lat ?? null,
      lon: wialon?.lon ?? null,
      speedKmh: wialon?.speedKmh ?? null,
      distanceKm: wialon?.distanceKm ?? latest.distanceKm,
    });
  }

  return rows.sort((a, b) => a.reg.localeCompare(b.reg));
}
