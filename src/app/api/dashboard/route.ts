import { NextResponse } from "next/server";
import { isGoogleSheetsConfigured } from "@/lib/config/env";
import { parseReportingDateRange } from "@/lib/google-sheets/reporting-date-range";
import { loadDashboardBundle } from "@/lib/dashboard/load-bundle";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const { from, to } = parseReportingDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    const data = await loadDashboardBundle(from, to, {
      forceSync: forceRefresh,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";

    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          error:
            "Google Sheets sync is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and credentials to refresh data.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
