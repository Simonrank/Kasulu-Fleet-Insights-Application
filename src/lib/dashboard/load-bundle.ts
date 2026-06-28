import type { DashboardBundle } from "@/lib/types";
import { isGoogleSheetsConfigured } from "@/lib/config/env";
import { getDashboardBundle } from "@/lib/google-sheets/dashboard-cache";
import { getFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { getUtilizationBundle } from "@/lib/google-sheets/utilization-cache";
import { emptySpeedViolationsSummary } from "@/lib/fleet/speed-violations-analytics";

/** Dashboard KPIs, thefts, fleet, and utilization — one sheet fetch. */
export async function loadDashboardBundle(
  from: Date,
  to: Date
): Promise<DashboardBundle> {
  if (!isGoogleSheetsConfigured()) {
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_FLEET_RANGE."
    );
  }

  const dataset = await getFleetDataset();
  const bundle = getDashboardBundle(dataset, from, to);
  const utilization = getUtilizationBundle(dataset, from, to);

  return {
    ...bundle,
    utilization,
    speedViolations: emptySpeedViolationsSummary(),
    unitLatest: [],
    dataSource: "google_sheets",
  };
}
