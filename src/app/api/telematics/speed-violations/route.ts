import { NextResponse } from "next/server";
import { isTelematicsConfigured } from "@/lib/config/env";
import { buildSpeedViolationsSummary } from "@/lib/fleet/speed-violations-analytics";
import { getTelematicsSnapshot, prefetchTelematicsSnapshot } from "@/lib/telematics/snapshot";
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

    const snapshot = await getTelematicsSnapshot(from, to);
    const summary = buildSpeedViolationsSummary(snapshot?.speedViolations ?? []);

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load speeding violations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
