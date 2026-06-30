import { eq, and, gte, lte, desc, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { units, dailyUnitMetrics, fuelEvents, driverIncidents } from "@/lib/db/schema";
import {
  fleetCategoryKey,
  fleetCategoryLabel,
  tallyFleetByCategory,
  tallyFleetStatus,
} from "@/lib/fleet/categories";
import {
  connectivityBand,
  connectivityBandDetail,
  connectivityBandLabel,
  isUnitUpdating,
} from "@/lib/fleet/connectivity";
import { incidentTypeLabel } from "@/lib/fleet/violations-model";
import type { FleetSummary, UnitProblemsResponse, UnitProblem } from "@/lib/types";
import { KPI_TARGETS } from "@/lib/utils";

export async function getFleetSummary(): Promise<FleetSummary> {
  const rows = await db.select().from(units).orderBy(units.name);

  const unitRows = rows.map((unit) => mapUnitRow(unit));

  let updating = 0;
  let nonUpdating = 0;

  for (const row of unitRows) {
    if (row.isUpdating) updating++;
    else nonUpdating++;
  }

  const statusCounts = tallyFleetStatus(unitRows);

  return {
    summary: {
      total: rows.length,
      byCategory: tallyFleetByCategory(unitRows),
      updating,
      nonUpdating,
      ...statusCounts,
    },
    units: unitRows,
  };
}

function mapUnitRow(
  unit: typeof units.$inferSelect
): FleetSummary["units"][number] {
  const categoryDisplay = fleetCategoryLabel(
    unit.vehicleCategory,
    unit.vehicleType
  );

  const band = connectivityBand(unit.lastMessageAt);
  const updating = isUnitUpdating(unit.lastMessageAt);

  return {
    id: unit.id,
    wialonId: unit.wialonId,
    name: unit.name,
    plateNumber: unit.plateNumber,
    vehicleType: unit.vehicleType,
    category: categoryDisplay,
    categoryKey: fleetCategoryKey(unit.vehicleCategory, unit.vehicleType),
    driverName: unit.driverName,
    status: unit.status,
    isOnline: updating,
    isUpdating: updating,
    connectivityBand: band,
    lastMessageAt: unit.lastMessageAt?.toISOString() ?? null,
    lastLat: unit.lastLat,
    lastLon: unit.lastLon,
    lastSpeedKmh: null,
  };
}

export async function getUnitProblems(
  unitId: string,
  from: Date,
  to: Date
): Promise<UnitProblemsResponse> {
  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit) {
    throw new Error("Unit not found");
  }

  const unitRow = mapUnitRow(unit);
  const problems: UnitProblem[] = [];

  if (!unitRow.isUpdating) {
    const severity =
      unitRow.connectivityBand === "hours_48_plus" ||
      unitRow.connectivityBand === "unknown"
        ? "critical"
        : unitRow.connectivityBand === "hours_24_48"
          ? "high"
          : "medium";

    problems.push({
      id: `connectivity-${unit.id}`,
      category: "connectivity",
      severity,
      title: connectivityBandLabel(unitRow.connectivityBand),
      description: unit.lastMessageAt
        ? `${connectivityBandDetail(unitRow.connectivityBand)}. Last update: ${unit.lastMessageAt.toISOString()}`
        : connectivityBandDetail(unitRow.connectivityBand),
      occurredAt: unit.lastMessageAt?.toISOString() ?? null,
    });
  }

  if (unit.status === "inactive") {
    problems.push({
      id: `status-inactive-${unit.id}`,
      category: "status",
      severity: "medium",
      title: "Unit marked inactive",
      description: "This vehicle is flagged as inactive in the fleet register",
      occurredAt: null,
    });
  }

  if (unit.status === "maintenance") {
    problems.push({
      id: `status-maintenance-${unit.id}`,
      category: "status",
      severity: "low",
      title: "Unit in maintenance",
      description: "This vehicle is currently under maintenance",
      occurredAt: null,
    });
  }

  const thefts = await db
    .select()
    .from(fuelEvents)
    .where(
      and(
        eq(fuelEvents.unitId, unitId),
        eq(fuelEvents.eventType, "theft"),
        gte(fuelEvents.occurredAt, from),
        lte(fuelEvents.occurredAt, to)
      )
    )
    .orderBy(desc(fuelEvents.occurredAt));

  for (const theft of thefts) {
    const theftLabel =
      theft.theftType === "return_pipe" ? "Return pipe theft" : "Direct fuel theft";
    problems.push({
      id: theft.id,
      category: "fuel_theft",
      severity: theft.volumeLiters >= 30 ? "critical" : "high",
      title: theftLabel,
      description: `${theft.volumeLiters.toFixed(1)} L stolen${theft.locationName ? ` at ${theft.locationName}` : ""}${theft.description ? ` — ${theft.description}` : ""}`,
      occurredAt: theft.occurredAt.toISOString(),
    });
  }

  const incidents = await db
    .select()
    .from(driverIncidents)
    .where(
      and(
        eq(driverIncidents.unitId, unitId),
        gte(driverIncidents.occurredAt, from),
        lte(driverIncidents.occurredAt, to)
      )
    )
    .orderBy(desc(driverIncidents.occurredAt));

  for (const incident of incidents) {
    const label = incidentTypeLabel(incident.incidentType);
    const severity =
      incident.severity === "critical" || incident.severity === "high"
        ? incident.severity
        : incident.severity === "low"
          ? "low"
          : "medium";

    problems.push({
      id: incident.id,
      category: "driver_incident",
      severity: severity as UnitProblem["severity"],
      title: label,
      description: [
        incident.value != null && incident.threshold != null
          ? `Value ${incident.value} (threshold ${incident.threshold})`
          : null,
        incident.locationName ? `Location: ${incident.locationName}` : null,
        incident.notes,
      ]
        .filter(Boolean)
        .join(" · ") || "Driver behaviour incident recorded",
      occurredAt: incident.occurredAt.toISOString(),
    });
  }

  const [metrics] = await db
    .select({
      engineHours: sum(dailyUnitMetrics.engineHours),
      productiveHours: sum(dailyUnitMetrics.productiveHours),
    })
    .from(dailyUnitMetrics)
    .where(
      and(
        eq(dailyUnitMetrics.unitId, unitId),
        gte(dailyUnitMetrics.date, from),
        lte(dailyUnitMetrics.date, to)
      )
    );

  const engineHours = Number(metrics?.engineHours ?? 0);
  const productiveHours = Number(metrics?.productiveHours ?? 0);
  const utilizationPercent =
    engineHours > 0 ? (productiveHours / engineHours) * 100 : 0;

  if (
    KPI_TARGETS.utilizationPercent != null &&
    engineHours > 0 &&
    utilizationPercent < KPI_TARGETS.utilizationPercent
  ) {
    problems.push({
      id: `utilization-${unit.id}`,
      category: "utilization",
      severity: utilizationPercent < 50 ? "high" : "medium",
      title: "Low utilization",
      description: `${utilizationPercent.toFixed(1)}% utilization in period (target ${KPI_TARGETS.utilizationPercent}%)`,
      occurredAt: to.toISOString(),
    });
  }

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  problems.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "")
  );

  const summary = {
    totalProblems: problems.length,
    critical: problems.filter((p) => p.severity === "critical").length,
    high: problems.filter((p) => p.severity === "high").length,
    medium: problems.filter((p) => p.severity === "medium").length,
    low: problems.filter((p) => p.severity === "low").length,
  };

  return {
    unit: unitRow,
    summary,
    problems,
    period: { from: from.toISOString(), to: to.toISOString() },
  };
}
