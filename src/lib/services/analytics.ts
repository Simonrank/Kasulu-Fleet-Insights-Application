import { eq, and, gte, lte, desc, count, sum, avg } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  units,
  dailyUnitMetrics,
  fuelEvents,
  driverIncidents,
} from "@/lib/db/schema";
import type {
  KpiSummary,
  FuelTheftsResponse,
  DriverIncidentRow,
  ReportSummary,
  UtilizationSummary,
  TheftFilter,
  TheftType,
} from "@/lib/types";
import {
  connectivityBand,
  tallyConnectivityFromLastMessages,
} from "@/lib/fleet/connectivity";
import {
  fleetCategoryLabel,
  tallyFleetByCategory,
} from "@/lib/fleet/categories";
import { KPI_TARGETS, averageSheetMetric } from "@/lib/utils";

export async function getKpiSummary(from: Date, to: Date): Promise<KpiSummary> {
  const metrics = await db
    .select({
      distanceKm: sum(dailyUnitMetrics.distanceKm),
      engineHours: sum(dailyUnitMetrics.engineHours),
      productiveHours: sum(dailyUnitMetrics.productiveHours),
      fuelLiters: sum(dailyUnitMetrics.fuelConsumedLiters),
    })
    .from(dailyUnitMetrics)
    .where(
      and(
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    );

  const fleetUnits = await db.select().from(units);
  const connectivityBands = tallyConnectivityFromLastMessages(
    fleetUnits.map((u) => u.lastMessageAt)
  );
  const updating = connectivityBands.updating;

  const theftStats = await db
    .select({
      theftType: fuelEvents.theftType,
      count: count(),
      volume: sum(fuelEvents.volumeLiters),
    })
    .from(fuelEvents)
    .where(
      and(
        eq(fuelEvents.eventType, "theft"),
        gte(fuelEvents.occurredAt, from),
        lte(fuelEvents.occurredAt, to)
      )
    )
    .groupBy(fuelEvents.theftType);

  const direct = theftStats.find((s) => s.theftType === "direct");
  const returnPipe = theftStats.find((s) => s.theftType === "return_pipe");

  const distance = Number(metrics[0]?.distanceKm ?? 0);
  const engineHours = Number(metrics[0]?.engineHours ?? 0);
  const productiveHours = Number(metrics[0]?.productiveHours ?? 0);
  const fuelLiters = Number(metrics[0]?.fuelLiters ?? 0);

  const maxProductiveCapacity = engineHours > 0 ? engineHours : 1;
  const utilizationPercent =
    engineHours > 0 ? (productiveHours / maxProductiveCapacity) * 100 : 0;

  const sheetConsumption = await db
    .select({
      kmPerLiter: dailyUnitMetrics.kmPerLiter,
      litersPerHour: dailyUnitMetrics.litersPerHour,
    })
    .from(dailyUnitMetrics)
    .where(
      and(
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    );

  const consumptionKmPerLiter = averageSheetMetric(
    sheetConsumption.map((r) => Number(r.kmPerLiter ?? 0))
  );
  const consumptionLitersPerHour = averageSheetMetric(
    sheetConsumption.map((r) => Number(r.litersPerHour ?? 0))
  );

  return {
    consumptionKmPerLiter:
      consumptionKmPerLiter > 0
        ? consumptionKmPerLiter
        : fuelLiters > 0
          ? distance / fuelLiters
          : 0,
    consumptionLitersPerHour:
      consumptionLitersPerHour > 0
        ? consumptionLitersPerHour
        : engineHours > 0
          ? fuelLiters / engineHours
          : 0,
    totalDistanceKm: distance,
    totalEngineHours: engineHours,
    utilizationPercent,
    updatingUnits: updating,
    nonUpdatingUnits: fleetUnits.length - updating,
    totalUnits: fleetUnits.length,
    connectivityBands,
    directThefts: {
      count: Number(direct?.count ?? 0),
      volumeLiters: Number(direct?.volume ?? 0),
    },
    returnPipeThefts: {
      count: Number(returnPipe?.count ?? 0),
      volumeLiters: Number(returnPipe?.volume ?? 0),
    },
    period: { from: from.toISOString(), to: to.toISOString() },
  };
}

export async function getFuelThefts(
  from: Date,
  to: Date,
  type: TheftFilter = "all"
): Promise<FuelTheftsResponse> {
  const theftConditions = [
    eq(fuelEvents.eventType, "theft"),
    gte(fuelEvents.occurredAt, from),
    lte(fuelEvents.occurredAt, to),
  ];

  if (type !== "all") {
    theftConditions.push(eq(fuelEvents.theftType, type));
  }

  const allUnits = await db.select().from(units);

  const metricsByUnit = await db
    .select({
      unitId: units.id,
      distanceKm: sum(dailyUnitMetrics.distanceKm),
      fuelConsumedLiters: sum(dailyUnitMetrics.fuelConsumedLiters),
      fuelFilledLiters: sum(dailyUnitMetrics.fuelFilledLiters),
      engineHours: sum(dailyUnitMetrics.engineHours),
      avgKmPerLiter: avg(dailyUnitMetrics.kmPerLiter),
      avgLitersPerHour: avg(dailyUnitMetrics.litersPerHour),
    })
    .from(units)
    .leftJoin(
      dailyUnitMetrics,
      and(
        eq(dailyUnitMetrics.unitId, units.id),
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    )
    .groupBy(units.id);

  const metricsMap = new Map(
    metricsByUnit.map((m) => [
      m.unitId,
      {
        distanceKm: Number(m.distanceKm ?? 0),
        fuelConsumedLiters: Number(m.fuelConsumedLiters ?? 0),
        fuelFilledLiters: Number(m.fuelFilledLiters ?? 0),
        engineHours: Number(m.engineHours ?? 0),
        avgKmPerLiter: Number(m.avgKmPerLiter ?? 0),
        avgLitersPerHour: Number(m.avgLitersPerHour ?? 0),
      },
    ])
  );

  const theftByUnit = await db
    .select({
      unitId: fuelEvents.unitId,
      theftType: fuelEvents.theftType,
      count: count(),
      volume: sum(fuelEvents.volumeLiters),
    })
    .from(fuelEvents)
    .where(and(...theftConditions))
    .groupBy(fuelEvents.unitId, fuelEvents.theftType);

  const theftUnitMap = new Map<
    string,
    { direct: number; returnPipe: number; directCount: number; returnPipeCount: number }
  >();

  for (const row of theftByUnit) {
    const entry = theftUnitMap.get(row.unitId) ?? {
      direct: 0,
      returnPipe: 0,
      directCount: 0,
      returnPipeCount: 0,
    };
    const vol = Number(row.volume ?? 0);
    const cnt = Number(row.count ?? 0);
    if (row.theftType === "return_pipe") {
      entry.returnPipe += vol;
      entry.returnPipeCount += cnt;
    } else {
      entry.direct += vol;
      entry.directCount += cnt;
    }
    theftUnitMap.set(row.unitId, entry);
  }

  const fillingStats = await db
    .select({
      count: count(),
      volume: sum(fuelEvents.volumeLiters),
    })
    .from(fuelEvents)
    .where(
      and(
        eq(fuelEvents.eventType, "filling"),
        gte(fuelEvents.occurredAt, from),
        lte(fuelEvents.occurredAt, to)
      )
    );

  const allTheftStats = await db
    .select({
      theftType: fuelEvents.theftType,
      count: count(),
      volume: sum(fuelEvents.volumeLiters),
    })
    .from(fuelEvents)
    .where(
      and(
        eq(fuelEvents.eventType, "theft"),
        gte(fuelEvents.occurredAt, from),
        lte(fuelEvents.occurredAt, to)
      )
    )
    .groupBy(fuelEvents.theftType);

  const directAll = allTheftStats.find((t) => t.theftType === "direct");
  const returnPipeAll = allTheftStats.find((t) => t.theftType === "return_pipe");

  const fleetTable = allUnits.map((unit) => {
    const metrics = metricsMap.get(unit.id) ?? {
      distanceKm: 0,
      fuelConsumedLiters: 0,
      fuelFilledLiters: 0,
      engineHours: 0,
      avgKmPerLiter: 0,
      avgLitersPerHour: 0,
    };
    const thefts = theftUnitMap.get(unit.id) ?? {
      direct: 0,
      returnPipe: 0,
      directCount: 0,
      returnPipeCount: 0,
    };
    return {
      unitId: unit.id,
      reg: unit.plateNumber ?? unit.name.split("—")[0]?.trim() ?? unit.name,
      category: fleetCategoryLabel(unit.vehicleCategory, unit.vehicleType),
      distanceKm: metrics.distanceKm,
      fuelConsumedLiters: metrics.fuelConsumedLiters,
      directTheftLiters: thefts.direct,
      returnPipeTheftLiters: thefts.returnPipe,
      totalTheftLiters: thefts.direct + thefts.returnPipe,
      kmPerLiter: metrics.avgKmPerLiter,
      litersPerHour: metrics.avgLitersPerHour,
      hoursPerLiter:
        metrics.avgKmPerLiter > 0 ? 1 / metrics.avgKmPerLiter : 0,
      engineHours: metrics.engineHours,
    };
  });

  const categoryTheft = new Map<
    string,
    { direct: number; returnPipe: number }
  >();

  for (const unit of allUnits) {
    const cat = fleetCategoryLabel(unit.vehicleCategory, unit.vehicleType);
    const thefts = theftUnitMap.get(unit.id);
    if (!thefts) continue;
    const entry = categoryTheft.get(cat) ?? { direct: 0, returnPipe: 0 };
    entry.direct += thefts.direct;
    entry.returnPipe += thefts.returnPipe;
    categoryTheft.set(cat, entry);
  }

  const theftByCategory = [...categoryTheft.entries()]
    .map(([category, data]) => ({
      category,
      categoryKey: category === "—" ? "Uncategorized" : category,
      directLiters: data.direct,
      returnPipeLiters: data.returnPipe,
      totalLiters: data.direct + data.returnPipe,
    }))
    .sort((a, b) => b.totalLiters - a.totalLiters);

  const totalDistance = fleetTable.reduce((s, r) => s + r.distanceKm, 0);
  const totalFuel = fleetTable.reduce((s, r) => s + r.fuelConsumedLiters, 0);
  const totalEngineHours = fleetTable.reduce((s, r) => s + r.engineHours, 0);
  const totalDrainVolume =
    Number(directAll?.volume ?? 0) + Number(returnPipeAll?.volume ?? 0);

  const events = await db
    .select({
      id: fuelEvents.id,
      unitId: fuelEvents.unitId,
      unitName: units.name,
      theftType: fuelEvents.theftType,
      volumeLiters: fuelEvents.volumeLiters,
      durationMinutes: fuelEvents.durationMinutes,
      occurredAt: fuelEvents.occurredAt,
      locationName: fuelEvents.locationName,
      description: fuelEvents.description,
    })
    .from(fuelEvents)
    .innerJoin(units, eq(fuelEvents.unitId, units.id))
    .where(and(...theftConditions))
    .orderBy(desc(fuelEvents.occurredAt));

  const violatorRows = await db
    .select({
      unitId: units.id,
      unitName: units.name,
      driverName: units.driverName,
      theftCount: count(fuelEvents.id),
      theftVolume: sum(fuelEvents.volumeLiters),
      engineHours: sum(dailyUnitMetrics.engineHours),
    })
    .from(fuelEvents)
    .innerJoin(units, eq(fuelEvents.unitId, units.id))
    .leftJoin(
      dailyUnitMetrics,
      and(
        eq(dailyUnitMetrics.unitId, units.id),
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    )
    .where(and(...theftConditions))
    .groupBy(units.id, units.name, units.driverName)
    .orderBy(desc(count(fuelEvents.id)));

  const performance = violatorRows.map((row, index) => {
    const engineH = Number(row.engineHours ?? 0) || 1;
    const theftRate = Number(row.theftCount) / engineH;
    return {
      unitId: row.unitId,
      unitName: row.unitName,
      driverName: row.driverName,
      theftCount: Number(row.theftCount),
      theftVolumeLiters: Number(row.theftVolume ?? 0),
      theftRate,
      rank: index + 1,
    };
  });

  const topViolators = [...performance]
    .sort((a, b) => b.theftCount - a.theftCount || b.theftRate - a.theftRate)
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const bestPerformers = [...performance]
    .sort((a, b) => a.theftRate - b.theftRate || a.theftCount - b.theftCount)
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const overviewKmPerLiter = averageSheetMetric(
    fleetTable.map((r) => r.kmPerLiter)
  );
  const overviewLitersPerHour = averageSheetMetric(
    fleetTable.map((r) => r.litersPerHour)
  );

  return {
    overview: {
      totalFleet: allUnits.length,
      distanceKm: totalDistance,
      kmPerLiter: overviewKmPerLiter,
      litersPerHour: overviewLitersPerHour,
      hoursPerLiter: overviewKmPerLiter > 0 ? 1 / overviewKmPerLiter : 0,
      directTheft: {
        count: Number(directAll?.count ?? 0),
        volumeLiters: Number(directAll?.volume ?? 0),
      },
      returnPipeTheft: {
        count: Number(returnPipeAll?.count ?? 0),
        volumeLiters: Number(returnPipeAll?.volume ?? 0),
      },
      fuelFillings: {
        count: Number(fillingStats[0]?.count ?? 0),
        volumeLiters: Number(fillingStats[0]?.volume ?? 0),
      },
      fuelDrains: {
        count:
          Number(directAll?.count ?? 0) + Number(returnPipeAll?.count ?? 0),
        volumeLiters: totalDrainVolume,
      },
      fuelConsumedLiters: totalFuel,
      engineHours: totalEngineHours,
    },
    theftByCategory,
    fleetTable,
    summary: {
      direct: {
        count: Number(directAll?.count ?? 0),
        volumeLiters: Number(directAll?.volume ?? 0),
      },
      returnPipe: {
        count: Number(returnPipeAll?.count ?? 0),
        volumeLiters: Number(returnPipeAll?.volume ?? 0),
      },
      total: {
        count:
          Number(directAll?.count ?? 0) + Number(returnPipeAll?.count ?? 0),
        volumeLiters: totalDrainVolume,
      },
    },
    topViolators,
    bestPerformers,
    events: events.map((e) => ({
      id: e.id,
      unitId: e.unitId,
      unitName: e.unitName,
      theftType: (e.theftType ?? "direct") as TheftType,
      volumeLiters: e.volumeLiters,
      durationMinutes: e.durationMinutes,
      occurredAt: e.occurredAt.toISOString(),
      locationName: e.locationName,
      description: e.description,
    })),
  };
}

export async function getDriverIncidents(
  from: Date,
  to: Date
): Promise<DriverIncidentRow[]> {
  const rows = await db
    .select({
      id: driverIncidents.id,
      unitId: driverIncidents.unitId,
      unitName: units.name,
      driverName: driverIncidents.driverName,
      incidentType: driverIncidents.incidentType,
      severity: driverIncidents.severity,
      value: driverIncidents.value,
      threshold: driverIncidents.threshold,
      occurredAt: driverIncidents.occurredAt,
      locationName: driverIncidents.locationName,
    })
    .from(driverIncidents)
    .innerJoin(units, eq(driverIncidents.unitId, units.id))
    .where(
      and(
        gte(driverIncidents.occurredAt, from),
        lte(driverIncidents.occurredAt, to)
      )
    )
    .orderBy(desc(driverIncidents.occurredAt));

  return rows.map((r) => ({
    ...r,
    incidentType: r.incidentType,
    occurredAt: r.occurredAt.toISOString(),
  }));
}

export async function getUtilization(
  from: Date,
  to: Date
): Promise<UtilizationSummary> {
  const { isGoogleSheetsConfigured } = await import("@/lib/config/env");
  if (isGoogleSheetsConfigured()) {
    const { getSheetUtilization } = await import(
      "@/lib/google-sheets/utilization"
    );
    return getSheetUtilization(from, to);
  }

  const rows = await db
    .select({
      unitId: units.id,
      unitName: units.name,
      driverName: units.driverName,
      distanceKm: sum(dailyUnitMetrics.distanceKm),
      engineHours: sum(dailyUnitMetrics.engineHours),
      productiveHours: sum(dailyUnitMetrics.productiveHours),
      idleHours: sum(dailyUnitMetrics.idleHours),
      fuelConsumedLiters: sum(dailyUnitMetrics.fuelConsumedLiters),
    })
    .from(dailyUnitMetrics)
    .innerJoin(units, eq(dailyUnitMetrics.unitId, units.id))
    .where(
      and(
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    )
    .groupBy(units.id, units.name, units.driverName)
    .orderBy(units.name);

  const byUnit = rows
    .map((r) => {
      const distanceKm = Number(r.distanceKm ?? 0);
      const engineHours = Number(r.engineHours ?? 0);
      const productive = Number(r.productiveHours ?? 0);
      const idle = Number(r.idleHours ?? 0);
      return {
        unitId: r.unitId,
        unitName: r.unitName,
        driverName: r.driverName,
        distanceKm,
        engineHours,
        productiveHours: productive,
        idleHours: idle,
        fuelConsumedLiters: Number(r.fuelConsumedLiters ?? 0),
        violationCount: 0,
        kmPerEngineHour: engineHours > 0 ? distanceKm / engineHours : 0,
      };
    })
    .sort((a, b) => b.distanceKm - a.distanceKm);

  const totalDistanceKm = byUnit.reduce((s, u) => s + u.distanceKm, 0);
  const totalEngineHours = byUnit.reduce((s, u) => s + u.engineHours, 0);
  const totalProductiveHours = byUnit.reduce(
    (s, u) => s + u.productiveHours,
    0
  );
  const totalIdleHours = byUnit.reduce((s, u) => s + u.idleHours, 0);

  const bucketLabels = [
    "0–100 km",
    "101–500 km",
    "501–1000 km",
    "1001–2000 km",
    "2000+ km",
  ] as const;
  const bucketRanges = [
    [0, 100],
    [101, 500],
    [501, 1000],
    [1001, 2000],
    [2001, Infinity],
  ] as const;
  const distanceBuckets = bucketLabels.map((label, i) => ({
    label,
    count: byUnit.filter((u) => {
      const [min, max] = bucketRanges[i];
      return u.distanceKm >= min && u.distanceKm <= max;
    }).length,
  }));

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

export async function getReportSummary(
  from: Date,
  to: Date,
  period: ReportSummary["period"]
): Promise<ReportSummary> {
  const kpis = await getKpiSummary(from, to);

  const byUnit = await db
    .select({
      unitName: units.name,
      distanceKm: sum(dailyUnitMetrics.distanceKm),
      engineHours: sum(dailyUnitMetrics.engineHours),
      fuelLiters: sum(dailyUnitMetrics.fuelConsumedLiters),
      avgKmPerLiter: avg(dailyUnitMetrics.kmPerLiter),
      avgLitersPerHour: avg(dailyUnitMetrics.litersPerHour),
    })
    .from(dailyUnitMetrics)
    .innerJoin(units, eq(dailyUnitMetrics.unitId, units.id))
    .where(
      and(
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    )
    .groupBy(units.name);

  const theftByUnit = await db
    .select({
      unitName: units.name,
      theftCount: count(fuelEvents.id),
    })
    .from(fuelEvents)
    .innerJoin(units, eq(fuelEvents.unitId, units.id))
    .where(
      and(
        eq(fuelEvents.eventType, "theft"),
        gte(fuelEvents.occurredAt, from),
        lte(fuelEvents.occurredAt, to)
      )
    )
    .groupBy(units.name);

  const theftMap = new Map(
    theftByUnit.map((t) => [t.unitName, Number(t.theftCount)])
  );

  const incidentCount = await db
    .select({ count: count() })
    .from(driverIncidents)
    .where(
      and(
        gte(driverIncidents.occurredAt, from),
        lte(driverIncidents.occurredAt, to)
      )
    );

  const variance = [
    KPI_TARGETS.utilizationPercent != null && {
      metric: "Utilization",
      actual: kpis.utilizationPercent,
      target: KPI_TARGETS.utilizationPercent,
      deviationPercent:
        ((kpis.utilizationPercent - KPI_TARGETS.utilizationPercent) /
          KPI_TARGETS.utilizationPercent) *
        100,
      status:
        kpis.utilizationPercent >= KPI_TARGETS.utilizationPercent
          ? ("positive" as const)
          : ("negative" as const),
    },
    KPI_TARGETS.kmPerLiter != null && {
      metric: "Km/L",
      actual: kpis.consumptionKmPerLiter,
      target: KPI_TARGETS.kmPerLiter,
      deviationPercent:
        ((kpis.consumptionKmPerLiter - KPI_TARGETS.kmPerLiter) /
          KPI_TARGETS.kmPerLiter) *
        100,
      status:
        kpis.consumptionKmPerLiter >= KPI_TARGETS.kmPerLiter
          ? ("positive" as const)
          : ("negative" as const),
    },
    KPI_TARGETS.litersPerHour != null && {
      metric: "L/hr",
      actual: kpis.consumptionLitersPerHour,
      target: KPI_TARGETS.litersPerHour,
      deviationPercent:
        ((KPI_TARGETS.litersPerHour - kpis.consumptionLitersPerHour) /
          KPI_TARGETS.litersPerHour) *
        100,
      status:
        kpis.consumptionLitersPerHour <= KPI_TARGETS.litersPerHour
          ? ("positive" as const)
          : ("negative" as const),
    },
  ].filter(Boolean) as ReportSummary["variance"];

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    fleet: {
      distanceKm: kpis.totalDistanceKm,
      engineHours: kpis.totalEngineHours,
      fuelLiters:
        kpis.consumptionLitersPerHour * kpis.totalEngineHours || 0,
      utilizationPercent: kpis.utilizationPercent,
      theftCount:
        kpis.directThefts.count + kpis.returnPipeThefts.count,
      incidentCount: Number(incidentCount[0]?.count ?? 0),
    },
    byUnit: byUnit.map((u) => ({
      unitName: u.unitName,
      distanceKm: Number(u.distanceKm ?? 0),
      engineHours: Number(u.engineHours ?? 0),
      fuelLiters: Number(u.fuelLiters ?? 0),
      kmPerLiter: Number(u.avgKmPerLiter ?? 0),
      litersPerHour: Number(u.avgLitersPerHour ?? 0),
      theftCount: theftMap.get(u.unitName) ?? 0,
    })),
    variance,
  };
}
