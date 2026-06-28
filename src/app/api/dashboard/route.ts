import { NextResponse } from "next/server";
import { triggerGoogleSheetsSyncIfStale } from "@/lib/google-sheets/ensure-sync";
import { prefetchFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { isGoogleSheetsConfigured, isTelematicsConfigured } from "@/lib/config/env";
import { loadDashboardBundle } from "@/lib/dashboard/load-bundle";
import { prefetchTelematicsSnapshot } from "@/lib/telematics/snapshot";
import { parseDateRange } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: "Google Sheets is not configured." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    triggerGoogleSheetsSyncIfStale();
    prefetchFleetDataset();

    if (isTelematicsConfigured()) {
      prefetchTelematicsSnapshot(from, to);
    }

    const data = await loadDashboardBundle(from, to);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
