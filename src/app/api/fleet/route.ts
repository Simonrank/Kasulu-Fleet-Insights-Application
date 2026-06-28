import { NextResponse } from "next/server";
import { getFleetSummary } from "@/lib/services/fleet";
import { withSheetData } from "@/lib/google-sheets/with-sheet-data";

export async function GET() {
  try {
    const data = await withSheetData(() => getFleetSummary());
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch fleet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
