import { NextResponse } from "next/server";
import { getUtilization } from "@/lib/services/analytics";
import { parseReportingDateRange } from "@/lib/google-sheets/reporting-date-range";
import { loadDashboardBundle } from "@/lib/dashboard/load-bundle";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = parseReportingDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    // Warm Postgres from sheets if needed (same path as dashboard).
    await loadDashboardBundle(from, to);

    const data = await getUtilization(from, to);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch utilization";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
