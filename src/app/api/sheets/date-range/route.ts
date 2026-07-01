import { NextResponse } from "next/server";
import { getDbReportingDateRange, hasSyncedMetrics } from "@/lib/db/reporting-date-range";
import {
  markSheetsSynced,
  triggerGoogleSheetsSyncIfStale,
} from "@/lib/google-sheets/ensure-sync";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";
import { isGoogleSheetsConfigured } from "@/lib/config/env";

export const maxDuration = 60;

export async function GET() {
  try {
    triggerGoogleSheetsSyncIfStale();

    let range = await getDbReportingDateRange();

    if (!range && isGoogleSheetsConfigured()) {
      await syncFromGoogleSheets();
      markSheetsSynced();
      range = await getDbReportingDateRange();
    }

    if (!range) {
      const hasData = await hasSyncedMetrics();
      return NextResponse.json(
        {
          error: hasData
            ? "No dated metrics found in database"
            : "No synced sheet data yet. Run sync or wait for the scheduled job.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(range, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read date range";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
