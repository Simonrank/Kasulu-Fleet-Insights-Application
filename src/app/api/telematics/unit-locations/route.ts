import { NextResponse } from "next/server";
import { isTelematicsConfigured } from "@/lib/config/env";
import { prefetchTelematicsSnapshot } from "@/lib/telematics/snapshot";
import { getLiveUnitLocations } from "@/lib/telematics/locations";
import { parseDateRange } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    if (!isTelematicsConfigured()) {
      return NextResponse.json(
        { error: "Live telematics is not configured" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    prefetchTelematicsSnapshot(from, to);

    const rows = await getLiveUnitLocations(from, to);
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load unit locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
