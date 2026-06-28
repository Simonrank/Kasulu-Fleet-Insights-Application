import type { DashboardBundle, FleetDataSource } from "@/lib/types";
import {
  appConfig,
  isGoogleSheetsConfigured,
  isWialonReportConfigured,
} from "@/lib/config/env";
import { getDashboardBundle } from "@/lib/google-sheets/dashboard-cache";
import { getFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { getWialonFleetDataset } from "@/lib/wialon/fleet-dataset";
import { buildDashboardFromSheet } from "@/lib/google-sheets/dashboard-analytics";
import {
  buildSpeedViolationsSummary,
  emptySpeedViolationsSummary,
} from "@/lib/fleet/speed-violations-analytics";
import { getSpeedViolations } from "@/lib/wialon/speed-violations";

export type ResolvedDataSource = FleetDataSource;

export function resolveDataSource(
  requested: string | null
): ResolvedDataSource {
  const sheets = isGoogleSheetsConfigured();
  const wialon = isWialonReportConfigured();

  if (requested === "wialon" && wialon) return "wialon";
  if (requested === "google_sheets" && sheets) return "google_sheets";

  if (appConfig.dataSource === "wialon" && wialon) return "wialon";
  if (sheets) return "google_sheets";
  if (wialon) return "wialon";

  throw new Error(
    "No fleet data source configured. Set Google Sheets or Wialon report env vars."
  );
}

export function bothDataSourcesAvailable(): boolean {
  return isGoogleSheetsConfigured() && isWialonReportConfigured();
}

export async function loadDashboardBundle(
  from: Date,
  to: Date,
  source: ResolvedDataSource
): Promise<DashboardBundle> {
  if (source === "wialon") {
    const dataset = await getWialonFleetDataset(from, to);
    const bundle = buildDashboardFromSheet(dataset, from, to);
    return { ...bundle, dataSource: "wialon" };
  }

  const dataset = await getFleetDataset();
  const bundle = getDashboardBundle(dataset, from, to);

  const speedViolations = isWialonReportConfigured()
    ? buildSpeedViolationsSummary(await getSpeedViolations(from, to))
    : emptySpeedViolationsSummary();

  return {
    ...bundle,
    speedViolations,
    dataSource: "google_sheets",
  };
}
