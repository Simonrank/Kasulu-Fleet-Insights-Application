import { NextResponse } from "next/server";
import { getUtilization } from "@/lib/services/analytics";
import { parseDateRange } from "@/lib/utils";
import { withSheetData } from "@/lib/google-sheets/with-sheet-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    const data = await withSheetData(() => getUtilization(from, to));
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch utilization";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
