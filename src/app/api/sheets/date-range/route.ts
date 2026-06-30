import { NextResponse } from "next/server";
import { isGoogleSheetsConfigured } from "@/lib/config/env";
import { hasGoogleSheetsCredentials } from "@/lib/google-sheets/client";
import { buildSheetReportingDateRange } from "@/lib/google-sheets/date-range";
import { getFleetDataset } from "@/lib/google-sheets/fleet-dataset";

export const maxDuration = 60;

export async function GET() {
  try {
    if (!isGoogleSheetsConfigured() || !hasGoogleSheetsCredentials()) {
      return NextResponse.json(
        { error: "Google Sheets is not configured" },
        { status: 503 }
      );
    }

    const dataset = await getFleetDataset();
    const range = buildSheetReportingDateRange(dataset.rows);

    if (!range) {
      return NextResponse.json(
        { error: "No dated rows found in the fleet sheet" },
        { status: 404 }
      );
    }

    return NextResponse.json(range, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read sheet date range";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
