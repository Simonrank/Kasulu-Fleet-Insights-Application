import { NextResponse } from "next/server";
import { isTelematicsConfigured } from "@/lib/config/env";
import { prefetchTelematicsSnapshot } from "@/lib/telematics/snapshot";
import { getFleetViolations } from "@/lib/services/violations";
import { parseDriverIncidentsDateRange } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = parseDriverIncidentsDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    if (isTelematicsConfigured()) {
      prefetchTelematicsSnapshot(from, to);
    }

    const data = await getFleetViolations(from, to);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch incidents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
