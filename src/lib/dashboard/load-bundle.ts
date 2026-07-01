import type { DashboardBundle } from "@/lib/types";
import { getDbReportingDateRange, hasSyncedMetrics } from "@/lib/db/reporting-date-range";
import { emptySpeedViolationsSummary } from "@/lib/fleet/speed-violations-analytics";
import {
  markSheetsSynced,
  triggerGoogleSheetsSyncIfStale,
} from "@/lib/google-sheets/ensure-sync";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";
import {
  getFuelThefts,
  getKpiSummary,
  getUtilization,
} from "@/lib/services/analytics";
import { getFleetSummary } from "@/lib/services/fleet";

type LoadOptions = {
  /** Pull latest sheet rows into Postgres before reading. */
  forceSync?: boolean;
};

/** Dashboard KPIs, thefts, fleet, and utilization — Postgres fast path (synced from sheets). */
export async function loadDashboardBundle(
  from: Date,
  to: Date,
  options: LoadOptions = {}
): Promise<DashboardBundle> {
  if (options.forceSync) {
    await syncFromGoogleSheets();
    markSheetsSynced();
  } else {
    triggerGoogleSheetsSyncIfStale();
    if (!(await hasSyncedMetrics())) {
      await syncFromGoogleSheets();
      markSheetsSynced();
    }
  }

  const [kpis, thefts, fleet, utilization, sheetDateRange] = await Promise.all([
    getKpiSummary(from, to),
    getFuelThefts(from, to, "all"),
    getFleetSummary(),
    getUtilization(from, to),
    getDbReportingDateRange(),
  ]);

  return {
    kpis,
    thefts,
    fleet,
    utilization,
    speedViolations: emptySpeedViolationsSummary(),
    unitLatest: [],
    dataSource: "postgres",
    sheetDateRange: sheetDateRange ?? undefined,
    fetchedAt: new Date().toISOString(),
  };
}
