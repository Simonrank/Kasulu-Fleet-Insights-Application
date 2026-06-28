import { NextResponse } from "next/server";
import { isWialonReportConfigured } from "@/lib/config/env";
import { loadDashboardBundle } from "@/lib/dashboard/load-bundle";
import { parseDateRange } from "@/lib/utils";

/** Live Wialon report pull for the same reporting window as the dashboard. */
export async function GET(request: Request) {
  if (!isWialonReportConfigured()) {
    return NextResponse.json(
      {
        error:
          "Wialon report not configured. Set WIALON_TOKEN, WIALON_REPORT_RESOURCE_ID, WIALON_REPORT_TEMPLATE_ID, and WIALON_REPORT_GROUP_ID.",
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    const data = await loadDashboardBundle(from, to, "wialon");

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Wialon data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
