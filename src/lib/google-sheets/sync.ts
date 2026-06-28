import { startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { fuelEvents, units } from "@/lib/db/schema";
import { googleSheetsConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import { fetchSheetRange } from "@/lib/google-sheets/client";
import {
  connectivityFromSheet,
  headerIndexMap,
  internalUnitIdFromSheetKey,
  parseKasuluFleetRow,
} from "@/lib/google-sheets/parse";
import { upsertDailyMetric, upsertFuelTheftEvent } from "@/lib/wialon/sync";

export type SheetsSyncResult = {
  success: boolean;
  unitsSynced: number;
  fuelEventsSynced: number;
  incidentsSynced: number;
  metricsSynced: number;
  message: string;
};

function syncDaysCutoff(): Date {
  const days = googleSheetsConfig.syncDays;
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  return startOfDay(subDays(new Date(), safeDays));
}

function sheetEventId(
  kind: "theft" | "fill",
  machineId: string,
  date: Date
): string {
  return `sheet-${kind}-${machineId}-${startOfDay(date).toISOString()}`;
}

async function syncKasuluFleetSheet(): Promise<{
  unitsSynced: number;
  fuelEventsSynced: number;
  metricsSynced: number;
  rowsSkipped: number;
}> {
  const rows = await fetchSheetRange(googleSheetsConfig.ranges.fleet);
  if (rows.length < 2) {
    return { unitsSynced: 0, fuelEventsSynced: 0, metricsSynced: 0, rowsSkipped: 0 };
  }

  const cutoff = syncDaysCutoff();
  const map = headerIndexMap(rows[0]);

  const parsedRows = rows
    .slice(1)
    .map((row) => parseKasuluFleetRow(row, map))
    .filter((row): row is NonNullable<typeof row> => row != null);

  const latestByMachine = new Map<string, (typeof parsedRows)[number]>();
  for (const row of parsedRows) {
    const prev = latestByMachine.get(row.machineId);
    if (!prev || row.date > prev.date) {
      latestByMachine.set(row.machineId, row);
    }
  }

  const inRange = parsedRows.filter((row) => startOfDay(row.date) >= cutoff);
  const rowsSkipped = parsedRows.length - inRange.length;

  const unitNames = new Set<string>();
  let fuelEventsSynced = 0;
  let metricsSynced = 0;

  async function upsertFromRow(parsed: (typeof parsedRows)[number]) {
    const isOnline = connectivityFromSheet(parsed.comment, parsed.lastMessageAt);

    const [unit] = await db
      .insert(units)
      .values({
        wialonId: internalUnitIdFromSheetKey(parsed.machineId),
        name: parsed.machineId,
        lastMessageAt: parsed.lastMessageAt,
        isOnline,
        sheetComment: parsed.comment || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: units.name,
        set: {
          lastMessageAt: parsed.lastMessageAt,
          isOnline,
          sheetComment: parsed.comment || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    unitNames.add(parsed.machineId);

    await upsertDailyMetric({
      unitId: unit.id,
      date: startOfDay(parsed.date),
      distanceKm: parsed.distanceKm,
      engineHours: parsed.engineHours,
      productiveHours: 0,
      idleHours: 0,
      fuelConsumedLiters: parsed.fuelConsumedLiters,
      fuelFilledLiters: parsed.fuelFilledLiters,
      kmPerLiter: parsed.kmPerLiter,
      litersPerHour: parsed.litersPerHour,
      initialFuelLevel: parsed.initialFuelLevel,
      finalFuelLevel: parsed.finalFuelLevel,
    });
    metricsSynced++;

    if (parsed.fuelTheftLiters > 0) {
      await upsertFuelTheftEvent({
        unitId: unit.id,
        wialonEventId: sheetEventId("theft", parsed.machineId, parsed.date),
        volumeLiters: parsed.fuelTheftLiters,
        occurredAt: parsed.date,
        description: parsed.comment || undefined,
        theftType: null,
      });
      fuelEventsSynced++;
    }

    if (parsed.fuelFilledLiters > 0) {
      await db
        .insert(fuelEvents)
        .values({
          unitId: unit.id,
          wialonEventId: sheetEventId("fill", parsed.machineId, parsed.date),
          eventType: "filling",
          volumeLiters: parsed.fuelFilledLiters,
          occurredAt: parsed.date,
          description: parsed.comment || undefined,
        })
        .onConflictDoUpdate({
          target: fuelEvents.wialonEventId,
          set: {
            volumeLiters: parsed.fuelFilledLiters,
            description: parsed.comment || undefined,
          },
        });
      fuelEventsSynced++;
    }
  }

  for (const row of inRange) {
    await upsertFromRow(row);
  }

  for (const latest of latestByMachine.values()) {
    if (startOfDay(latest.date) >= cutoff) continue;

    const isOnline = connectivityFromSheet(latest.comment, latest.lastMessageAt);
    await db
      .insert(units)
      .values({
        wialonId: internalUnitIdFromSheetKey(latest.machineId),
        name: latest.machineId,
        lastMessageAt: latest.lastMessageAt,
        isOnline,
        sheetComment: latest.comment || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: units.name,
        set: {
          lastMessageAt: latest.lastMessageAt,
          isOnline,
          sheetComment: latest.comment || null,
          updatedAt: new Date(),
        },
      });
    unitNames.add(latest.machineId);
  }

  return {
    unitsSynced: unitNames.size,
    fuelEventsSynced,
    metricsSynced,
    rowsSkipped,
  };
}

export async function syncFromGoogleSheets(): Promise<SheetsSyncResult> {
  if (!isGoogleSheetsConfigured()) {
    return {
      success: false,
      unitsSynced: 0,
      fuelEventsSynced: 0,
      incidentsSynced: 0,
      metricsSynced: 0,
      message:
        "Google Sheets not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_FLEET_RANGE.",
    };
  }

  try {
    const fleet = await syncKasuluFleetSheet();

    return {
      success: fleet.metricsSynced > 0 || fleet.unitsSynced > 0,
      unitsSynced: fleet.unitsSynced,
      fuelEventsSynced: fleet.fuelEventsSynced,
      incidentsSynced: 0,
      metricsSynced: fleet.metricsSynced,
      message:
        fleet.metricsSynced > 0
          ? `Google Sheet sync: ${fleet.unitsSynced} machines, ${fleet.metricsSynced} rows (${fleet.rowsSkipped} older rows skipped), ${fleet.fuelEventsSynced} fuel events`
          : "Google Sheet returned no rows in the configured sync window",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sheets sync failed";
    return {
      success: false,
      unitsSynced: 0,
      fuelEventsSynced: 0,
      incidentsSynced: 0,
      metricsSynced: 0,
      message,
    };
  }
}
