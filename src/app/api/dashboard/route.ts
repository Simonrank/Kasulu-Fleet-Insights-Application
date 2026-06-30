import { NextResponse } from "next/server";
import { prefetchFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { hasGoogleSheetsCredentials } from "@/lib/google-sheets/client";
import { isGoogleSheetsConfigured } from "@/lib/config/env";
import { parseReportingDateRange } from "@/lib/google-sheets/reporting-date-range";
import { loadDashboardBundle } from "@/lib/dashboard/load-bundle";

/** Large sheets can exceed Vercel's default 10s limit — allow up to 60s on Pro. */
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          error:
            "Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_FLEET_RANGE in your deployment environment.",
        },
        { status: 503 }
      );
    }

    if (!hasGoogleSheetsCredentials()) {
      return NextResponse.json(
        {
          error:
            "Google Sheets credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_KEY) to the full service account JSON — not a file path.",
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    if (forceRefresh) {
      const { invalidateFleetDatasetCache } = await import(
        "@/lib/google-sheets/fleet-dataset"
      );
      invalidateFleetDatasetCache();
    }

    const { from, to } = parseReportingDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    prefetchFleetDataset();

    const data = await loadDashboardBundle(from, to);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
