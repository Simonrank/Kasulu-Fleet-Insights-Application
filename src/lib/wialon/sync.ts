import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  units,
  dailyUnitMetrics,
  fuelEvents,
  driverIncidents,
  syncLogs,
} from "@/lib/db/schema";
import { WialonClient, createWialonClient } from "@/lib/wialon/client";
import {
  classifyTheftType,
  unixToDate,
} from "@/lib/wialon/normalize";
import { wialonConfig } from "@/lib/config/env";
import { withWialonSessionLock } from "@/lib/wialon/session-lock";

const WIALON_ONLINE_THRESHOLD_MS =
  Number(process.env.ONLINE_THRESHOLD_MINUTES ?? "30") * 60 * 1000;

export type SyncResult = {
  success: boolean;
  unitsSynced: number;
  eventsSynced: number;
  message: string;
};

export async function syncFromWialon(): Promise<SyncResult> {
  return withWialonSessionLock(async () => {
    const client = createWialonClient();

    const [log] = await db
      .insert(syncLogs)
      .values({ status: "running" })
      .returning();

    if (!client) {
      await db
        .update(syncLogs)
        .set({
          status: "failed",
          errorMessage: "WIALON_TOKEN not configured",
          finishedAt: new Date(),
        })
        .where(eq(syncLogs.id, log.id));

      return {
        success: false,
        unitsSynced: 0,
        eventsSynced: 0,
        message: "WIALON_TOKEN not configured",
      };
    }

    try {
      const wialonUnits = await client.getUnits();
      let eventsSynced = 0;
      const now = Date.now();

      for (const wUnit of wialonUnits) {
        const lastMsgTime = wUnit.lmsg?.t ?? wUnit.pos?.t;
        const lastMessageAt = unixToDate(lastMsgTime);
        const isOnline =
          !!lastMessageAt &&
          now - lastMessageAt.getTime() <= WIALON_ONLINE_THRESHOLD_MS;

        const [unit] = await db
          .insert(units)
          .values({
            wialonId: wUnit.id,
            name: wUnit.nm,
            lastMessageAt,
            lastLat: wUnit.pos?.y,
            lastLon: wUnit.pos?.x,
            isOnline,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: units.wialonId,
            set: {
              name: wUnit.nm,
              lastMessageAt,
              lastLat: wUnit.pos?.y,
              lastLon: wUnit.pos?.x,
              isOnline,
              updatedAt: new Date(),
            },
          })
          .returning();

        eventsSynced += await syncUnitReports(client, unit.id, wUnit.id);
      }

      await client.logout();

      await db
        .update(syncLogs)
        .set({
          status: "success",
          unitsSynced: wialonUnits.length,
          eventsSynced,
          finishedAt: new Date(),
        })
        .where(eq(syncLogs.id, log.id));

      return {
        success: true,
        unitsSynced: wialonUnits.length,
        eventsSynced,
        message: `Synced ${wialonUnits.length} units`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      await db
        .update(syncLogs)
        .set({
          status: "failed",
          errorMessage: message,
          finishedAt: new Date(),
        })
        .where(eq(syncLogs.id, log.id));

      return {
        success: false,
        unitsSynced: 0,
        eventsSynced: 0,
        message,
      };
    }
  });
}

async function syncUnitReports(
  _client: WialonClient,
  _unitId: string,
  _wialonUnitId: number
): Promise<number> {
  // Placeholder for report/exec_report integration.
  // Configure WIALON_REPORT_RESOURCE_ID and WIALON_REPORT_TEMPLATE_ID in env.
  const resourceId = wialonConfig.reportResourceId;
  const templateId = wialonConfig.reportTemplateId;

  if (!resourceId || !templateId) {
    return 0;
  }

  // TODO: parse report rows → dailyUnitMetrics, fuelEvents, driverIncidents
  return 0;
}

export async function upsertFuelTheftEvent(input: {
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
}) {
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

export async function upsertDailyMetric(input: {
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
}) {
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

export async function upsertDriverIncident(input: {
  unitId: string;
  wialonEventId?: string;
  incidentType: typeof driverIncidents.$inferInsert.incidentType;
  severity?: string;
  value?: number;
  threshold?: number;
  occurredAt: Date;
  locationName?: string;
  driverName?: string;
}) {
  const values = {
    ...input,
    severity: input.severity ?? "medium",
    wialonEventId: input.wialonEventId ?? `incident-${input.unitId}-${input.occurredAt.toISOString()}`,
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
