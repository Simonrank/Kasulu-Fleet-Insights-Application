import { db } from "@/lib/db";
import { units } from "@/lib/db/schema";
import { googleSheetsConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import { fetchSheetRange } from "@/lib/google-sheets/client";
import {
  headerIndexMap,
  parseKasuluFleetRow,
  type ParsedKasuluFleetRow,
} from "@/lib/google-sheets/parse";
import type {
  ParsedSpeedingRow,
  ParsedUnitLatestRow,
} from "@/lib/wialon/parse-report";

const CACHE_TTL_MS = 120_000;
const UNIT_ID_TTL_MS = 5 * 60_000;

export type FleetDataset = {
  rows: ParsedKasuluFleetRow[];
  /** machineId → Postgres unit UUID (when synced) */
  unitIds: Map<string, string>;
  fetchedAt: number;
  /** Wialon "Unit latest data" snapshot (when available) */
  unitLatestSnapshots?: ParsedUnitLatestRow[];
  /** Wialon "Speedings" rows for the reporting period */
  speedViolations?: ParsedSpeedingRow[];
  /** Wialon "Violations" rows (fuel theft, zone speed, geofence, etc.) */
  wialonViolations?: import("@/lib/wialon/parse-report").ParsedWialonViolationRow[];
};

let cache: FleetDataset | null = null;
let loadPromise: Promise<FleetDataset> | null = null;
let unitIdCache: { map: Map<string, string>; fetchedAt: number } | null = null;

async function loadUnitIdMap(): Promise<Map<string, string>> {
  if (
    unitIdCache &&
    Date.now() - unitIdCache.fetchedAt < UNIT_ID_TTL_MS
  ) {
    return unitIdCache.map;
  }

  try {
    const rows = await db.select({ id: units.id, name: units.name }).from(units);
    const map = new Map(rows.map((r) => [r.name, r.id]));
    unitIdCache = { map, fetchedAt: Date.now() };
    return map;
  } catch {
    return unitIdCache?.map ?? new Map();
  }
}

async function loadFromSheet(): Promise<FleetDataset> {
  if (!isGoogleSheetsConfigured()) {
    return { rows: [], unitIds: new Map(), fetchedAt: Date.now() };
  }

  const [rawRows, unitIds] = await Promise.all([
    fetchSheetRange(googleSheetsConfig.ranges.fleet),
    loadUnitIdMap(),
  ]);

  const map = headerIndexMap(rawRows[0] ?? []);
  const rows = rawRows
    .slice(1)
    .map((row) => parseKasuluFleetRow(row, map))
    .filter((row): row is ParsedKasuluFleetRow => row != null);

  return { rows, unitIds, fetchedAt: Date.now() };
}

/** Parsed fleet rows from Google Sheets — shared cache, ~90s TTL. */
export async function getFleetDataset(): Promise<FleetDataset> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  if (!loadPromise) {
    loadPromise = loadFromSheet()
      .then((dataset) => {
        cache = dataset;
        return dataset;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

/** Warm cache without blocking callers (server startup / background refresh). */
export function prefetchFleetDataset(): void {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
  void (async () => {
    const dataset = await getFleetDataset();
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const { getDashboardBundle } = await import(
      "@/lib/google-sheets/dashboard-cache"
    );
    const { getUtilizationBundle } = await import(
      "@/lib/google-sheets/utilization-cache"
    );
    getDashboardBundle(dataset, from, to);
    getUtilizationBundle(dataset, from, to);
  })();
}

export function invalidateFleetDatasetCache(): void {
  cache = null;
}
