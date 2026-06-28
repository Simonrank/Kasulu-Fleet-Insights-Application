import { NextResponse } from "next/server";
import { isGoogleSheetsConfigured } from "@/lib/config/env";
import { getSheetUtilization } from "@/lib/google-sheets/utilization";
import { prefetchFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { triggerGoogleSheetsSyncIfStale } from "@/lib/google-sheets/ensure-sync";
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

    const data = await getSheetUtilization(from, to);
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
