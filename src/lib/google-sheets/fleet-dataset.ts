import { loadUnitIdMap } from "@/lib/db/unit-id-map";
import { googleSheetsConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import { fetchSheetRange } from "@/lib/google-sheets/client";
import {
  getCategoryRegister,
  invalidateCategoryRegisterCache,
  setCategoryRegisterCache,
} from "@/lib/fleet/category-register";
import {
  parseKasuluFleetSheet,
  type ParsedKasuluFleetRow,
} from "@/lib/google-sheets/parse";
import type {
  ParsedSpeedingRow,
  ParsedUnitLatestRow,
} from "@/lib/wialon/parse-report";

const CACHE_TTL_MS = 300_000;

export type FleetDataset = {
  rows: ParsedKasuluFleetRow[];
  /** machineId → Postgres unit UUID (when synced) */
  unitIds: Map<string, string>;
  fetchedAt: number;
  /** Asset name → category from register sheet tab */
  categoryRegister: Map<string, string>;
  /** Wialon "Unit latest data" snapshot (when available) */
  unitLatestSnapshots?: ParsedUnitLatestRow[];
  /** Wialon "Speedings" rows for the reporting period */
  speedViolations?: ParsedSpeedingRow[];
  /** Wialon "Violations" rows (fuel theft, zone speed, geofence, etc.) */
  wialonViolations?: import("@/lib/wialon/parse-report").ParsedWialonViolationRow[];
};

let cache: FleetDataset | null = null;
let loadPromise: Promise<FleetDataset> | null = null;

async function loadFromSheet(): Promise<FleetDataset> {
  if (!isGoogleSheetsConfigured()) {
    return {
      rows: [],
      unitIds: new Map(),
      categoryRegister: new Map(),
      fetchedAt: Date.now(),
    };
  }

  const fleetRange = googleSheetsConfig.ranges.fleet;

  const [rawRows, unitIds, categoryRegister] = await Promise.all([
    fetchSheetRange(fleetRange),
    loadUnitIdMap(),
    getCategoryRegister(),
  ]);

  if (categoryRegister.size > 0) {
    setCategoryRegisterCache(categoryRegister);
  }

  const { rows, headerRowIndex } = parseKasuluFleetSheet(rawRows);

  if (rawRows.length > 2 && rows.length === 0) {
    console.warn(
      `[fleet-dataset] Parsed 0 rows from ${rawRows.length} sheet rows (header at index ${headerRowIndex}). Check column headers and GOOGLE_SHEETS_FLEET_RANGE.`
    );
  }

  return { rows, unitIds, categoryRegister, fetchedAt: Date.now() };
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
  if (!isGoogleSheetsConfigured()) return;
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;

  void (async () => {
    try {
      const dataset = await getFleetDataset();
      const { buildSheetReportingDateRange } = await import(
        "@/lib/google-sheets/date-range"
      );
      const sheetRange = buildSheetReportingDateRange(dataset.rows);
      if (!sheetRange) return;
      const from = new Date(sheetRange.defaultFrom);
      const to = new Date(sheetRange.defaultTo);
      const { getDashboardBundle } = await import(
        "@/lib/google-sheets/dashboard-cache"
      );
      const { getUtilizationBundle } = await import(
        "@/lib/google-sheets/utilization-cache"
      );
      getDashboardBundle(dataset, from, to);
      getUtilizationBundle(dataset, from, to);
    } catch {
      // Best-effort warm — credentials may be unavailable during CI/build.
    }
  })();
}

export function invalidateFleetDatasetCache(): void {
  cache = null;
  invalidateCategoryRegisterCache();
}
