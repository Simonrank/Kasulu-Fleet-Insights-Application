import { loadUnitIdMap } from "@/lib/db/unit-id-map";
import { googleSheetsConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import { fetchSheetRanges } from "@/lib/google-sheets/client";
import {
  getCategoryRegister,
  invalidateCategoryRegisterCache,
  parseCategoryRegisterRows,
  setCategoryRegisterCache,
} from "@/lib/fleet/category-register";
import {
  parseKasuluFleetSheet,
  type ParsedKasuluFleetRow,
} from "@/lib/google-sheets/parse";
import { clearDashboardAggregateCache } from "@/lib/google-sheets/dashboard-cache";
import { clearUtilizationAggregateCache } from "@/lib/google-sheets/utilization-cache";
import type {
  ParsedSpeedingRow,
  ParsedUnitLatestRow,
} from "@/lib/wialon/parse-report";

/** Fresh TTL — serve without re-fetching Google Sheets. */
const CACHE_TTL_MS = 600_000;
/** Stale TTL — return cached data immediately while refreshing in the background. */
const STALE_TTL_MS = 1_800_000;

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
  const registerRange = googleSheetsConfig.registerRange?.trim();
  const ranges = registerRange ? [fleetRange, registerRange] : [fleetRange];

  const [sheetData, unitIds] = await Promise.all([
    fetchSheetRanges(ranges),
    loadUnitIdMap(),
  ]);

  const rawRows = sheetData.get(fleetRange) ?? [];

  const categoryRegister = registerRange
    ? parseCategoryRegisterRows(sheetData.get(registerRange) ?? [])
    : await getCategoryRegister();

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

/** Parsed fleet rows from Google Sheets — shared cache with stale-while-revalidate. */
export async function getFleetDataset(): Promise<FleetDataset> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const staleCache =
    cache && now - cache.fetchedAt < STALE_TTL_MS ? cache : null;

  if (staleCache && !loadPromise) {
    loadPromise = loadFromSheet()
      .then((dataset) => {
        cache = dataset;
        clearDashboardAggregateCache();
        clearUtilizationAggregateCache();
        return dataset;
      })
      .finally(() => {
        loadPromise = null;
      });
    return staleCache;
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
  clearDashboardAggregateCache();
  clearUtilizationAggregateCache();
}
