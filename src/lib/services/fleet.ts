import { eq, and, gte, lte, desc, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { units, dailyUnitMetrics, fuelEvents, driverIncidents } from "@/lib/db/schema";
import {
  resolveFleetCategory,
  categoryLabel,
  type FleetCategory,
} from "@/lib/fleet/categories";
import type { FleetSummary, UnitProblemsResponse, UnitProblem } from "@/lib/types";
import { KPI_TARGETS } from "@/lib/utils";

export async function getFleetSummary(): Promise<FleetSummary> {
  const rows = await db.select().from(units).orderBy(units.name);

  let heavyMachines = 0;
  let lightVehicles = 0;
  let updating = 0;
  let nonUpdating = 0;
  let active = 0;
  let inactive = 0;
  let maintenance = 0;

  const unitRows = rows.map((unit) => mapUnitRow(unit));

  for (const row of unitRows) {
    if (row.categoryKey === "heavy_machine") heavyMachines++;
    else lightVehicles++;

    if (row.isUpdating) updating++;
    else nonUpdating++;

    if (row.status === "active") active++;
    else if (row.status === "inactive") inactive++;
    else if (row.status === "maintenance") maintenance++;
  }

  return {
    summary: {
      total: rows.length,
      heavyMachines,
      lightVehicles,
      updating,
      nonUpdating,
      active,
      inactive,
      maintenance,
    },
    units: unitRows,
  };
}

const INCIDENT_LABELS: Record<string, string> = {
  speed_violation: "Speed violation",
  harsh_braking: "Harsh braking",
  harsh_acceleration: "Harsh acceleration",
  geo_fence_breach: "Geofence breach",
  unauthorized_movement: "Unauthorized movement",
  idle_exceedance: "Excessive idle time",
};

function mapUnitRow(
  unit: typeof units.$inferSelect
): FleetSummary["units"][number] {
  const category = resolveFleetCategory(unit.vehicleType, unit.vehicleCategory);

  return {
    id: unit.id,
    wialonId: unit.wialonId,
    name: unit.name,
    plateNumber: unit.plateNumber,
    vehicleType: unit.vehicleType,
    category: unit.vehicleCategory ? categoryLabel(category) : "—",
    categoryKey: category as FleetCategory,
    driverName: unit.driverName,
    status: unit.status,
    isOnline: unit.isOnline,
    isUpdating: unit.isOnline,
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
    problems.push({
      id: `connectivity-${unit.id}`,
      category: "connectivity",
      severity: "high",
      title: "Non-updating telemetry",
      description: unit.lastMessageAt
        ? `No telemetry in the last 30 minutes. Last update: ${unit.lastMessageAt.toISOString()}`
        : "No telemetry messages received from this unit",
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
    const label =
      INCIDENT_LABELS[incident.incidentType] ?? incident.incidentType;
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
