import { getFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { getUtilizationBundle } from "@/lib/google-sheets/utilization-cache";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";
import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";
import { buildNaturalBuckets } from "@/lib/data-driven/buckets";
import type { UtilizationSummary } from "@/lib/types";

type UnitAgg = {
  unitId: string;
  unitName: string;
  category: string | null;
  distanceKm: number;
  engineHours: number;
  productiveHours: number;
  idleHours: number;
  fuelConsumedLiters: number;
  violationCount: number;
};

function unitDisplayName(machineId: string): string {
  return machineId.split("—")[0]?.trim() ?? machineId;
}

function inPeriod(row: ParsedKasuluFleetRow, from: Date, to: Date): boolean {
  return row.date >= from && row.date <= to;
}

/** Fleet utilization from a parsed sheet dataset — no extra network I/O. */
export function buildUtilizationFromDataset(
  dataset: FleetDataset,
  from: Date,
  to: Date
): UtilizationSummary {
  const periodRows = dataset.rows.filter((row) => inPeriod(row, from, to));
  const unitAgg = new Map<string, UnitAgg>();

  for (const row of periodRows) {
    const key = row.machineId;

    let agg = unitAgg.get(key);
    if (!agg) {
      agg = {
        unitId: dataset.unitIds.get(key) ?? key,
        unitName: unitDisplayName(row.machineId),
        category: row.category,
        distanceKm: 0,
        engineHours: 0,
        productiveHours: 0,
        idleHours: 0,
        fuelConsumedLiters: 0,
        violationCount: 0,
      };
      unitAgg.set(key, agg);
    }

    agg.distanceKm += row.distanceKm;
    agg.engineHours += row.engineHours;
    if (row.productiveHours != null) agg.productiveHours += row.productiveHours;
    if (row.idleHours != null) agg.idleHours += row.idleHours;
    agg.fuelConsumedLiters += row.fuelConsumedLiters;
    if (row.fuelTheftLiters > 0) agg.violationCount += 1;
  }

  const byUnit = [...unitAgg.values()]
    .map((u) => ({
      unitId: u.unitId,
      unitName: u.unitName,
      driverName: null as string | null,
      category: u.category,
      distanceKm: u.distanceKm,
      engineHours: u.engineHours,
      productiveHours: u.productiveHours,
      idleHours: u.idleHours,
      fuelConsumedLiters: u.fuelConsumedLiters,
      violationCount: u.violationCount,
      kmPerEngineHour: u.engineHours > 0 ? u.distanceKm / u.engineHours : 0,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm);

  const totalDistanceKm = byUnit.reduce((s, u) => s + u.distanceKm, 0);
  const totalEngineHours = byUnit.reduce((s, u) => s + u.engineHours, 0);
  const totalIdleHours = byUnit.reduce((s, u) => s + u.idleHours, 0);
  const totalProductiveHours = byUnit.reduce(
    (s, u) => s + u.productiveHours,
    0
  );

  const distanceBuckets = buildNaturalBuckets(
    byUnit.map((u) => u.distanceKm)
  ).map(({ label, count }) => ({ label, count }));

  return {
    fleet: {
      totalDistanceKm,
      totalEngineHours,
      totalProductiveHours,
      totalIdleHours,
      avgKmPerEngineHour:
        totalEngineHours > 0 ? totalDistanceKm / totalEngineHours : 0,
    },
    byUnit,
    distanceBuckets,
    period: { from: from.toISOString(), to: to.toISOString() },
  };
}

/** Fleet utilization from Google Sheets — uses shared dataset + aggregate cache. */
export async function getSheetUtilization(
  from: Date,
  to: Date
): Promise<UtilizationSummary> {
  const dataset = await getFleetDataset();
  return getUtilizationBundle(dataset, from, to);
}
