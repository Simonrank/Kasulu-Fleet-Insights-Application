import { startOfDay } from "date-fns";
import { tallyConnectivityFromLastMessages } from "@/lib/fleet/connectivity";
import {
  internalUnitIdFromSheetKey,
  sheetTheftType,
  type ParsedKasuluFleetRow,
} from "@/lib/google-sheets/parse";
import { latestRowByMachineDate } from "@/lib/google-sheets/latest-by-machine";
import { rowInReportingDayRange } from "@/lib/google-sheets/period-filter";
import type {
  DashboardBundle,
  FleetSummary,
  FuelFleetRow,
  FuelTheftDetail,
  FuelTheftsResponse,
  KpiSummary,
  TheftType,
  UnitPerformance,
} from "@/lib/types";
import {
  tallyFleetByCategory,
  tallyFleetStatus,
} from "@/lib/fleet/categories";
import { resolveAssetCategory } from "@/lib/fleet/asset-names";
import { averageSheetMetric } from "@/lib/utils";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { buildUnitLatestRows } from "@/lib/fleet/unit-latest";
import {
  buildSpeedViolationsSummary,
} from "@/lib/fleet/speed-violations-analytics";

function resolveUnitId(machineId: string, unitIds: Map<string, string>): string {
  return unitIds.get(machineId) ?? machineId;
}

function theftEventId(machineId: string, date: Date): string {
  return `sheet-theft-${machineId}-${startOfDay(date).toISOString()}`;
}

export function buildDashboardFromSheet(
  dataset: FleetDataset,
  from: Date,
  to: Date
): DashboardBundle {
  const { rows, unitIds, fetchedAt, categoryRegister } = dataset;

  const latestByMachine = latestRowByMachineDate(rows);

  const periodRows = rows.filter((r) => rowInReportingDayRange(r.date, from, to));

  let totalDistanceKm = 0;
  let totalEngineHours = 0;
  let totalProductiveHours = 0;
  let totalFuelLiters = 0;
  const kmPerLiterSamples: number[] = [];
  const litersPerHourSamples: number[] = [];

  type UnitAgg = {
    unitId: string;
    reg: string;
    categoryLabel: string | null;
    distanceKm: number;
    fuelConsumedLiters: number;
    fuelFilledLiters: number;
    engineHours: number;
    productiveHours: number;
    kmPerLiter: number[];
    litersPerHour: number[];
    directTheftLiters: number;
    returnPipeTheftLiters: number;
    untypedTheftLiters: number;
    directCount: number;
    returnPipeCount: number;
    untypedCount: number;
  };

  const unitAgg = new Map<string, UnitAgg>();
  const events: FuelTheftDetail[] = [];

  let directTheftCount = 0;
  let directTheftVolume = 0;
  let returnPipeTheftCount = 0;
  let returnPipeTheftVolume = 0;
  let fillingCount = 0;
  let fillingVolume = 0;

  const categoryTheft = new Map<string, { direct: number; returnPipe: number }>();

  for (const row of periodRows) {
    totalDistanceKm += row.distanceKm;
    totalEngineHours += row.engineHours;
    if (row.productiveHours != null) totalProductiveHours += row.productiveHours;
    totalFuelLiters += row.fuelConsumedLiters;

    if (row.kmPerLiter > 0) kmPerLiterSamples.push(row.kmPerLiter);
    if (row.litersPerHour > 0) litersPerHourSamples.push(row.litersPerHour);

    if (row.fuelFilledLiters > 0) {
      fillingCount++;
      fillingVolume += row.fuelFilledLiters;
    }

    const categoryLabelValue = resolveAssetCategory(
      row.machineId,
      row.category,
      categoryRegister
    );
    const unitId = resolveUnitId(row.machineId, unitIds);

    let agg = unitAgg.get(row.machineId);
    if (!agg) {
      agg = {
        unitId,
        reg: row.machineId.split("—")[0]?.trim() ?? row.machineId,
        categoryLabel: categoryLabelValue,
        distanceKm: 0,
        fuelConsumedLiters: 0,
        fuelFilledLiters: 0,
        engineHours: 0,
        productiveHours: 0,
        kmPerLiter: [],
        litersPerHour: [],
        directTheftLiters: 0,
        returnPipeTheftLiters: 0,
        untypedTheftLiters: 0,
        directCount: 0,
        returnPipeCount: 0,
        untypedCount: 0,
      };
      unitAgg.set(row.machineId, agg);
    }

    agg.distanceKm += row.distanceKm;
    agg.fuelConsumedLiters += row.fuelConsumedLiters;
    agg.fuelFilledLiters += row.fuelFilledLiters;
    agg.engineHours += row.engineHours;
    if (row.productiveHours != null) agg.productiveHours += row.productiveHours;
    if (row.kmPerLiter > 0) agg.kmPerLiter.push(row.kmPerLiter);
    if (row.litersPerHour > 0) agg.litersPerHour.push(row.litersPerHour);
    if (!agg.categoryLabel && categoryLabelValue) {
      agg.categoryLabel = categoryLabelValue;
    }

    if (row.fuelTheftLiters > 0) {
      const typed = sheetTheftType(row.theftType);
      const catKey = categoryLabelValue ?? "Uncategorized";
      const catEntry = categoryTheft.get(catKey) ?? { direct: 0, returnPipe: 0 };

      if (typed === "return_pipe") {
        returnPipeTheftCount++;
        returnPipeTheftVolume += row.fuelTheftLiters;
        agg.returnPipeTheftLiters += row.fuelTheftLiters;
        agg.returnPipeCount++;
        catEntry.returnPipe += row.fuelTheftLiters;
      } else if (typed === "direct") {
        directTheftCount++;
        directTheftVolume += row.fuelTheftLiters;
        agg.directTheftLiters += row.fuelTheftLiters;
        agg.directCount++;
        catEntry.direct += row.fuelTheftLiters;
      } else {
        directTheftCount++;
        directTheftVolume += row.fuelTheftLiters;
        agg.untypedTheftLiters += row.fuelTheftLiters;
        agg.untypedCount++;
        catEntry.direct += row.fuelTheftLiters;
      }
      categoryTheft.set(catKey, catEntry);

      events.push({
        id: theftEventId(row.machineId, row.date),
        unitId,
        unitName: row.machineId,
        theftType: typed ?? "direct",
        volumeLiters: row.fuelTheftLiters,
        durationMinutes: null,
        occurredAt: row.date.toISOString(),
        locationName: null,
        description: row.comment || row.theftType || null,
      });
    }
  }

  events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  const fleetUnits: FleetSummary["units"] = [];

  for (const [machineId, latest] of latestByMachine) {
    const categoryDisplay =
      resolveAssetCategory(
        machineId,
        latest.category,
        categoryRegister
      ) ?? "—";

    fleetUnits.push({
      id: resolveUnitId(machineId, unitIds),
      wialonId: internalUnitIdFromSheetKey(machineId),
      name: machineId,
      plateNumber: machineId.split("—")[0]?.trim() ?? machineId,
      vehicleType: categoryDisplay === "—" ? latest.category : categoryDisplay,
      category: categoryDisplay,
      categoryKey: categoryDisplay === "—" ? null : categoryDisplay,
      driverName: null,
      status: "active",
      isOnline: false,
      isUpdating: false,
      connectivityBand: "unknown",
      lastMessageAt: null,
      lastLat: null,
      lastLon: null,
      lastSpeedKmh: null,
    });
  }

  fleetUnits.sort((a, b) => a.name.localeCompare(b.name));

  const updatingUnits = 0;
  const connectivityBands = tallyConnectivityFromLastMessages(
    fleetUnits.map(() => null)
  );

  const totalUnits = latestByMachine.size;
  const utilizationPercent =
    totalEngineHours > 0 && totalProductiveHours > 0
      ? (totalProductiveHours / totalEngineHours) * 100
      : 0;

  const consumptionKmPerLiter = averageSheetMetric(kmPerLiterSamples);
  const consumptionLitersPerHour = averageSheetMetric(litersPerHourSamples);

  const kpis: KpiSummary = {
    consumptionKmPerLiter:
      consumptionKmPerLiter > 0
        ? consumptionKmPerLiter
        : totalFuelLiters > 0
          ? totalDistanceKm / totalFuelLiters
          : 0,
    consumptionLitersPerHour:
      consumptionLitersPerHour > 0
        ? consumptionLitersPerHour
        : totalEngineHours > 0
          ? totalFuelLiters / totalEngineHours
          : 0,
    totalDistanceKm,
    totalEngineHours,
    utilizationPercent,
    updatingUnits,
    nonUpdatingUnits: totalUnits - updatingUnits,
    totalUnits,
    connectivityBands,
    directThefts: { count: directTheftCount, volumeLiters: directTheftVolume },
    returnPipeThefts: {
      count: returnPipeTheftCount,
      volumeLiters: returnPipeTheftVolume,
    },
    period: { from: from.toISOString(), to: to.toISOString() },
  };

  const fleetTable: FuelFleetRow[] = [...unitAgg.values()].map((u) => {
    const avgKm = averageSheetMetric(u.kmPerLiter);
    const avgLph = averageSheetMetric(u.litersPerHour);
    return {
      unitId: u.unitId,
      reg: u.reg,
      category: u.categoryLabel ?? "—",
      distanceKm: u.distanceKm,
      fuelConsumedLiters: u.fuelConsumedLiters,
      directTheftLiters: u.directTheftLiters + u.untypedTheftLiters,
      returnPipeTheftLiters: u.returnPipeTheftLiters,
      totalTheftLiters:
        u.directTheftLiters + u.returnPipeTheftLiters + u.untypedTheftLiters,
      kmPerLiter: avgKm,
      litersPerHour: avgLph,
      hoursPerLiter: avgKm > 0 ? 1 / avgKm : 0,
      engineHours: u.engineHours,
    };
  });

  const violatorBase: UnitPerformance[] = [...unitAgg.values()]
    .filter((u) => u.directCount + u.returnPipeCount + u.untypedCount > 0)
    .map((u) => {
      const theftCount = u.directCount + u.returnPipeCount + u.untypedCount;
      const theftVolumeLiters =
        u.directTheftLiters + u.returnPipeTheftLiters + u.untypedTheftLiters;
      const engineH = u.engineHours || 1;
      return {
        unitId: u.unitId,
        unitName: u.reg,
        driverName: null,
        theftCount,
        theftVolumeLiters,
        theftRate: theftCount / engineH,
        rank: 0,
      };
    });

  const topViolators = [...violatorBase]
    .sort(
      (a, b) =>
        b.theftVolumeLiters - a.theftVolumeLiters ||
        b.theftCount - a.theftCount
    )
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const bestPerformers = [...violatorBase]
    .sort((a, b) => a.theftRate - b.theftRate || a.theftCount - b.theftCount)
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const theftByCategory = [...categoryTheft.entries()]
    .map(([category, data]) => ({
      category,
      categoryKey: category,
      directLiters: data.direct,
      returnPipeLiters: data.returnPipe,
      totalLiters: data.direct + data.returnPipe,
    }))
    .sort((a, b) => b.totalLiters - a.totalLiters);

  const statusCounts = tallyFleetStatus(fleetUnits);

  const totalDrainVolume = directTheftVolume + returnPipeTheftVolume;

  const thefts: FuelTheftsResponse = {
    overview: {
      totalFleet: totalUnits,
      distanceKm: totalDistanceKm,
      kmPerLiter: kpis.consumptionKmPerLiter,
      litersPerHour: kpis.consumptionLitersPerHour,
      hoursPerLiter:
        kpis.consumptionKmPerLiter > 0 ? 1 / kpis.consumptionKmPerLiter : 0,
      directTheft: kpis.directThefts,
      returnPipeTheft: kpis.returnPipeThefts,
      fuelFillings: { count: fillingCount, volumeLiters: fillingVolume },
      fuelDrains: {
        count: directTheftCount + returnPipeTheftCount,
        volumeLiters: totalDrainVolume,
      },
      fuelConsumedLiters: totalFuelLiters,
      engineHours: totalEngineHours,
    },
    theftByCategory,
    fleetTable,
    summary: {
      direct: kpis.directThefts,
      returnPipe: kpis.returnPipeThefts,
      total: {
        count: directTheftCount + returnPipeTheftCount,
        volumeLiters: totalDrainVolume,
      },
    },
    topViolators,
    bestPerformers,
    events,
  };

  const fleet: FleetSummary = {
    summary: {
      total: totalUnits,
      byCategory: tallyFleetByCategory(fleetUnits),
      updating: updatingUnits,
      nonUpdating: totalUnits - updatingUnits,
      ...statusCounts,
    },
    units: fleetUnits,
  };

  const unitLatest = buildUnitLatestRows(
    latestByMachine,
    unitIds,
    dataset.unitLatestSnapshots ?? []
  );

  const speedViolations = buildSpeedViolationsSummary(
    dataset.speedViolations ?? []
  );

  return {
    kpis,
    thefts,
    fleet,
    unitLatest,
    speedViolations,
    fetchedAt: new Date(fetchedAt).toISOString(),
  };
}
