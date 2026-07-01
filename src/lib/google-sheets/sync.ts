import { startOfDay, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { units } from "@/lib/db/schema";
import { getSyncDb, type SyncDb } from "@/lib/db/sync-client";
import {
  upsertDailyMetric,
  upsertFuelFillEvent,
  upsertFuelTheftEvent,
} from "@/lib/db/upserts";
import { googleSheetsConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import { fetchSheetRange } from "@/lib/google-sheets/client";
import { getCategoryRegister } from "@/lib/fleet/category-register";
import { normalizeAssetName } from "@/lib/fleet/asset-names";
import {
  buildSheetUnitWialonIdMap,
  connectivityFromSheet,
  parseKasuluFleetSheet,
} from "@/lib/google-sheets/parse";

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

async function syncKasuluFleetSheet(db: SyncDb): Promise<{
  unitsSynced: number;
  fuelEventsSynced: number;
  metricsSynced: number;
  rowsSkipped: number;
}> {
  const rawRows = await fetchSheetRange(googleSheetsConfig.ranges.fleet);
  if (rawRows.length < 2) {
    return { unitsSynced: 0, fuelEventsSynced: 0, metricsSynced: 0, rowsSkipped: 0 };
  }

  const cutoff = syncDaysCutoff();
  const { rows: parsedRows } = parseKasuluFleetSheet(rawRows);

  const latestByMachine = new Map<string, (typeof parsedRows)[number]>();
  for (const row of parsedRows) {
    const prev = latestByMachine.get(row.machineId);
    if (!prev || row.date > prev.date) {
      latestByMachine.set(row.machineId, row);
    }
  }

  const inRange = parsedRows.filter((row) => startOfDay(row.date) >= cutoff);
  const rowsSkipped = parsedRows.length - inRange.length;

  const allMachineNames = [
    ...new Set([
      ...parsedRows.map((row) => row.machineId),
      ...latestByMachine.keys(),
    ]),
  ];
  const wialonIdByName = buildSheetUnitWialonIdMap(allMachineNames);

  const unitNames = new Set<string>();
  let fuelEventsSynced = 0;
  let metricsSynced = 0;

  async function upsertFromRow(parsed: (typeof parsedRows)[number]) {
    const isOnline = connectivityFromSheet(parsed.comment, parsed.lastMessageAt);

    const wialonId = wialonIdByName.get(parsed.machineId);
    if (wialonId == null) {
      throw new Error(`Missing wialon_id mapping for unit: ${parsed.machineId}`);
    }

    const [unit] = await db
      .insert(units)
      .values({
        wialonId,
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

    if (!unit) {
      throw new Error(`Failed to upsert unit: ${parsed.machineId}`);
    }

    unitNames.add(parsed.machineId);

    await upsertDailyMetric(db, {
      unitId: unit.id,
      date: startOfDay(parsed.date),
      distanceKm: parsed.distanceKm,
      engineHours: parsed.engineHours,
      productiveHours: parsed.productiveHours ?? 0,
      idleHours: parsed.idleHours ?? 0,
      fuelConsumedLiters: parsed.fuelConsumedLiters,
      fuelFilledLiters: parsed.fuelFilledLiters,
      kmPerLiter: parsed.kmPerLiter,
      litersPerHour: parsed.litersPerHour,
      initialFuelLevel: parsed.initialFuelLevel,
      finalFuelLevel: parsed.finalFuelLevel,
    });
    metricsSynced++;

    if (parsed.fuelTheftLiters > 0) {
      await upsertFuelTheftEvent(db, {
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
      await upsertFuelFillEvent(db, {
        unitId: unit.id,
        wialonEventId: sheetEventId("fill", parsed.machineId, parsed.date),
        volumeLiters: parsed.fuelFilledLiters,
        occurredAt: parsed.date,
        description: parsed.comment || undefined,
      });
      fuelEventsSynced++;
    }
  }

  for (let i = 0; i < inRange.length; i++) {
    await upsertFromRow(inRange[i]!);
    if ((i + 1) % 100 === 0) {
      console.log(`[sync] ${i + 1}/${inRange.length} rows…`);
    }
  }

  for (const latest of latestByMachine.values()) {
    if (startOfDay(latest.date) >= cutoff) continue;

    const isOnline = connectivityFromSheet(latest.comment, latest.lastMessageAt);
    const wialonId = wialonIdByName.get(latest.machineId);
    if (wialonId == null) continue;

    await db
      .insert(units)
      .values({
        wialonId,
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

async function syncCategoryRegisterToUnits(db: SyncDb): Promise<number> {
  const register = await getCategoryRegister();
  if (register.size === 0) return 0;

  let updated = 0;
  const allUnits = await db.select({ id: units.id, name: units.name }).from(units);

  for (const unit of allUnits) {
    const category =
      register.get(normalizeAssetName(unit.name)) ??
      register.get(unit.name.trim());
    if (!category) continue;

    await db
      .update(units)
      .set({ vehicleCategory: category, updatedAt: new Date() })
      .where(eq(units.id, unit.id));
    updated++;
  }

  return updated;
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

  const db = getSyncDb();

  try {
    const fleet = await syncKasuluFleetSheet(db);
    const categoriesUpdated = await syncCategoryRegisterToUnits(db);

    return {
      success: fleet.metricsSynced > 0 || fleet.unitsSynced > 0,
      unitsSynced: fleet.unitsSynced,
      fuelEventsSynced: fleet.fuelEventsSynced,
      incidentsSynced: 0,
      metricsSynced: fleet.metricsSynced,
      message:
        fleet.metricsSynced > 0
          ? `Google Sheet sync: ${fleet.unitsSynced} machines, ${fleet.metricsSynced} rows (${fleet.rowsSkipped} older rows skipped), ${fleet.fuelEventsSynced} fuel events, ${categoriesUpdated} categories`
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
