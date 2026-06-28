import { startOfDay } from "date-fns";
import {
  categoryLabel,
  CATEGORY_LABELS,
  inferVehicleCategory,
  type FleetCategory,
} from "@/lib/fleet/categories";
import {
  connectivityFromSheet,
  internalUnitIdFromSheetKey,
  type ParsedKasuluFleetRow,
} from "@/lib/google-sheets/parse";
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
import { averageSheetMetric } from "@/lib/utils";
import { classifyTheftType } from "@/lib/wialon/normalize";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { buildUnitLatestRows } from "@/lib/fleet/unit-latest";
import {
  buildSpeedViolationsSummary,
} from "@/lib/fleet/speed-violations-analytics";

function inRange(date: Date, from: Date, to: Date): boolean {
  const d = startOfDay(date).getTime();
  return d >= startOfDay(from).getTime() && d <= startOfDay(to).getTime();
}

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
  const { rows, unitIds, fetchedAt } = dataset;

  const latestByMachine = new Map<string, ParsedKasuluFleetRow>();
  for (const row of rows) {
    const prev = latestByMachine.get(row.machineId);
    if (!prev || row.date > prev.date) {
      latestByMachine.set(row.machineId, row);
    }
  }

  const periodRows = rows.filter((r) => inRange(r.date, from, to));

  let totalDistanceKm = 0;
  let totalEngineHours = 0;
  let totalProductiveHours = 0;
  let totalFuelLiters = 0;
  const kmPerLiterSamples: number[] = [];
  const litersPerHourSamples: number[] = [];

  type UnitAgg = {
    unitId: string;
    reg: string;
    category: FleetCategory;
    distanceKm: number;
    fuelConsumedLiters: number;
    fuelFilledLiters: number;
    engineHours: number;
    kmPerLiter: number[];
    litersPerHour: number[];
    directTheftLiters: number;
    returnPipeTheftLiters: number;
    directCount: number;
    returnPipeCount: number;
  };

  const unitAgg = new Map<string, UnitAgg>();
  const events: FuelTheftDetail[] = [];

  let directTheftCount = 0;
  let directTheftVolume = 0;
  let returnPipeTheftCount = 0;
  let returnPipeTheftVolume = 0;
  let fillingCount = 0;
  let fillingVolume = 0;

  const categoryTheft = new Map<FleetCategory, { direct: number; returnPipe: number }>();

  for (const row of periodRows) {
    totalDistanceKm += row.distanceKm;
    totalEngineHours += row.engineHours;
    totalProductiveHours += row.engineHours * 0.75;
    totalFuelLiters += row.fuelConsumedLiters;

    if (row.kmPerLiter > 0) kmPerLiterSamples.push(row.kmPerLiter);
    if (row.litersPerHour > 0) litersPerHourSamples.push(row.litersPerHour);

    if (row.fuelFilledLiters > 0) {
      fillingCount++;
      fillingVolume += row.fuelFilledLiters;
    }

    const category = inferVehicleCategory(null, row.machineId);
    const unitId = resolveUnitId(row.machineId, unitIds);

    let agg = unitAgg.get(row.machineId);
    if (!agg) {
      agg = {
        unitId,
        reg: row.machineId.split("—")[0]?.trim() ?? row.machineId,
        category,
        distanceKm: 0,
        fuelConsumedLiters: 0,
        fuelFilledLiters: 0,
        engineHours: 0,
        kmPerLiter: [],
        litersPerHour: [],
        directTheftLiters: 0,
        returnPipeTheftLiters: 0,
        directCount: 0,
        returnPipeCount: 0,
      };
      unitAgg.set(row.machineId, agg);
    }

    agg.distanceKm += row.distanceKm;
    agg.fuelConsumedLiters += row.fuelConsumedLiters;
    agg.fuelFilledLiters += row.fuelFilledLiters;
    agg.engineHours += row.engineHours;
    if (row.kmPerLiter > 0) agg.kmPerLiter.push(row.kmPerLiter);
    if (row.litersPerHour > 0) agg.litersPerHour.push(row.litersPerHour);

    if (row.fuelTheftLiters > 0) {
      const theftType: TheftType = classifyTheftType(row.comment);
      const catEntry = categoryTheft.get(category) ?? { direct: 0, returnPipe: 0 };

      if (theftType === "return_pipe") {
        returnPipeTheftCount++;
        returnPipeTheftVolume += row.fuelTheftLiters;
        agg.returnPipeTheftLiters += row.fuelTheftLiters;
        agg.returnPipeCount++;
        catEntry.returnPipe += row.fuelTheftLiters;
      } else {
        directTheftCount++;
        directTheftVolume += row.fuelTheftLiters;
        agg.directTheftLiters += row.fuelTheftLiters;
        agg.directCount++;
        catEntry.direct += row.fuelTheftLiters;
      }
      categoryTheft.set(category, catEntry);

      events.push({
        id: theftEventId(row.machineId, row.date),
        unitId,
        unitName: row.machineId,
        theftType,
        volumeLiters: row.fuelTheftLiters,
        durationMinutes: null,
        occurredAt: row.date.toISOString(),
        locationName: null,
        description: row.comment || null,
      });
    }
  }

  events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  let updatingUnits = 0;
  let heavyMachines = 0;
  let lightVehicles = 0;

  const fleetUnits: FleetSummary["units"] = [];

  for (const [machineId, latest] of latestByMachine) {
    const isOnline = connectivityFromSheet(latest.comment, latest.lastMessageAt);
    if (isOnline) updatingUnits++;
    const categoryKey = inferVehicleCategory(null, machineId);
    if (categoryKey === "heavy_machine") heavyMachines++;
    else lightVehicles++;

    fleetUnits.push({
      id: resolveUnitId(machineId, unitIds),
      wialonId: internalUnitIdFromSheetKey(machineId),
      name: machineId,
      plateNumber: machineId.split("—")[0]?.trim() ?? machineId,
      vehicleType: null,
      category: categoryLabel(categoryKey),
      categoryKey,
      driverName: null,
      status: "active",
      isOnline,
      isUpdating: isOnline,
      lastMessageAt: latest.lastMessageAt?.toISOString() ?? null,
      lastLat: null,
      lastLon: null,
      lastSpeedKmh: null,
    });
  }

  fleetUnits.sort((a, b) => a.name.localeCompare(b.name));

  const totalUnits = latestByMachine.size;
  const utilizationPercent =
    totalEngineHours > 0 ? (totalProductiveHours / totalEngineHours) * 100 : 0;

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
      category: categoryLabel(u.category),
      distanceKm: u.distanceKm,
      fuelConsumedLiters: u.fuelConsumedLiters,
      directTheftLiters: u.directTheftLiters,
      returnPipeTheftLiters: u.returnPipeTheftLiters,
      totalTheftLiters: u.directTheftLiters + u.returnPipeTheftLiters,
      kmPerLiter: avgKm,
      litersPerHour: avgLph,
      hoursPerLiter: avgKm > 0 ? 1 / avgKm : 0,
      engineHours: u.engineHours,
    };
  });

  const violatorBase: UnitPerformance[] = [...unitAgg.values()]
    .filter((u) => u.directCount + u.returnPipeCount > 0)
    .map((u) => {
      const theftCount = u.directCount + u.returnPipeCount;
      const theftVolumeLiters = u.directTheftLiters + u.returnPipeTheftLiters;
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

  const theftByCategory = (Object.keys(CATEGORY_LABELS) as FleetCategory[]).map(
    (key) => {
      const data = categoryTheft.get(key) ?? { direct: 0, returnPipe: 0 };
      return {
        category: CATEGORY_LABELS[key],
        categoryKey: key,
        directLiters: data.direct,
        returnPipeLiters: data.returnPipe,
        totalLiters: data.direct + data.returnPipe,
      };
    }
  );

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
      heavyMachines,
      lightVehicles,
      updating: updatingUnits,
      nonUpdating: totalUnits - updatingUnits,
      active: totalUnits,
      inactive: 0,
      maintenance: 0,
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
