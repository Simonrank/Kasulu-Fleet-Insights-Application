import { fuelEvents, dailyUnitMetrics, driverIncidents } from "@/lib/db/schema";
import { classifyTheftType } from "@/lib/wialon/normalize";
import type { SyncDb } from "@/lib/db/sync-client";

export async function upsertFuelTheftEvent(
  db: SyncDb,
  input: {
    unitId: string;
    wialonEventId: string;
    volumeLiters: number;
    occurredAt: Date;
    description?: string;
    locationName?: string;
    locationLat?: number;
    locationLon?: number;
    durationMinutes?: number;
    theftType?: "direct" | "return_pipe" | null;
  }
) {
  const theftType =
    input.theftType !== undefined
      ? input.theftType
      : classifyTheftType(input.description);

  await db
    .insert(fuelEvents)
    .values({
      unitId: input.unitId,
      wialonEventId: input.wialonEventId,
      eventType: "theft",
      theftType: theftType ?? null,
      volumeLiters: input.volumeLiters,
      occurredAt: input.occurredAt,
      description: input.description,
      locationName: input.locationName,
      locationLat: input.locationLat,
      locationLon: input.locationLon,
      durationMinutes: input.durationMinutes,
    })
    .onConflictDoUpdate({
      target: fuelEvents.wialonEventId,
      set: {
        volumeLiters: input.volumeLiters,
        theftType: theftType ?? null,
        description: input.description,
        durationMinutes: input.durationMinutes,
      },
    });
}

export async function upsertFuelFillEvent(
  db: SyncDb,
  input: {
    unitId: string;
    wialonEventId: string;
    volumeLiters: number;
    occurredAt: Date;
    description?: string;
  }
) {
  await db
    .insert(fuelEvents)
    .values({
      unitId: input.unitId,
      wialonEventId: input.wialonEventId,
      eventType: "filling",
      volumeLiters: input.volumeLiters,
      occurredAt: input.occurredAt,
      description: input.description,
    })
    .onConflictDoUpdate({
      target: fuelEvents.wialonEventId,
      set: {
        volumeLiters: input.volumeLiters,
        description: input.description,
      },
    });
}

export async function upsertDailyMetric(
  db: SyncDb,
  input: {
    unitId: string;
    date: Date;
    distanceKm: number;
    engineHours: number;
    productiveHours: number;
    idleHours: number;
    fuelConsumedLiters: number;
    fuelFilledLiters?: number;
    kmPerLiter?: number;
    litersPerHour?: number;
    initialFuelLevel?: number;
    finalFuelLevel?: number;
  }
) {
  await db
    .insert(dailyUnitMetrics)
    .values({
      ...input,
      fuelFilledLiters: input.fuelFilledLiters ?? 0,
      kmPerLiter: input.kmPerLiter ?? 0,
      litersPerHour: input.litersPerHour ?? 0,
      initialFuelLevel: input.initialFuelLevel ?? 0,
      finalFuelLevel: input.finalFuelLevel ?? 0,
    })
    .onConflictDoUpdate({
      target: [dailyUnitMetrics.unitId, dailyUnitMetrics.date],
      set: {
        distanceKm: input.distanceKm,
        engineHours: input.engineHours,
        productiveHours: input.productiveHours,
        idleHours: input.idleHours,
        fuelConsumedLiters: input.fuelConsumedLiters,
        fuelFilledLiters: input.fuelFilledLiters ?? 0,
        kmPerLiter: input.kmPerLiter ?? 0,
        litersPerHour: input.litersPerHour ?? 0,
        initialFuelLevel: input.initialFuelLevel ?? 0,
        finalFuelLevel: input.finalFuelLevel ?? 0,
      },
    });
}

export async function upsertDriverIncident(
  db: SyncDb,
  input: {
    unitId: string;
    wialonEventId?: string;
    incidentType: typeof driverIncidents.$inferInsert.incidentType;
    severity?: string;
    value?: number;
    threshold?: number;
    occurredAt: Date;
    locationName?: string;
    driverName?: string;
  }
) {
  const values = {
    ...input,
    severity: input.severity ?? "medium",
    wialonEventId:
      input.wialonEventId ??
      `incident-${input.unitId}-${input.occurredAt.toISOString()}`,
  };

  await db
    .insert(driverIncidents)
    .values(values)
    .onConflictDoUpdate({
      target: driverIncidents.wialonEventId,
      set: {
        severity: values.severity,
        value: input.value,
        threshold: input.threshold,
        locationName: input.locationName,
        driverName: input.driverName,
      },
    });
}
