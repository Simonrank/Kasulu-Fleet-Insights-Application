import { NextResponse } from "next/server";
import { getFuelThefts } from "@/lib/services/analytics";
import { parseDateRange } from "@/lib/utils";
import type { TheftFilter } from "@/lib/types";

import { withSheetData } from "@/lib/google-sheets/with-sheet-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );
    const type = (searchParams.get("type") ?? "all") as TheftFilter;

    const data = await withSheetData(() => getFuelThefts(from, to, type));
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch fuel thefts";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
