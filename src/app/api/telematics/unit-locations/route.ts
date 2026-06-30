import { NextResponse } from "next/server";
import {
  isMobileStatusConfigured,
  isUnitLocationsConfigured,
} from "@/lib/config/env";
import { prefetchMobileStatus } from "@/lib/wialon/mobile-status";
import { prefetchTelematicsSnapshot } from "@/lib/telematics/snapshot";
import { getLiveUnitLocations } from "@/lib/telematics/locations";
import { parseDateRange } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    if (!isUnitLocationsConfigured()) {
      return NextResponse.json(
        { error: "Live telematics is not configured" },
        { status: 503 }
      );
    }

    prefetchMobileStatus();

    if (isMobileStatusConfigured()) {
      const rows = await getLiveUnitLocations();
      return NextResponse.json(rows, {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );

    prefetchTelematicsSnapshot(from, to);

    const rows = await getLiveUnitLocations(from, to);
    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load unit locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
