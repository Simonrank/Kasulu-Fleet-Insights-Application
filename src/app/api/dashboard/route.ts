import { NextResponse } from "next/server";
import { triggerGoogleSheetsSyncIfStale } from "@/lib/google-sheets/ensure-sync";
import { prefetchFleetDataset } from "@/lib/google-sheets/fleet-dataset";
import {
  isGoogleSheetsConfigured,
  isWialonReportConfigured,
} from "@/lib/config/env";
import {
  loadDashboardBundle,
  resolveDataSource,
} from "@/lib/dashboard/load-bundle";
import { prefetchWialonFleetDataset } from "@/lib/wialon/fleet-dataset";
import { getKpiSummary, getFuelThefts } from "@/lib/services/analytics";
import { getFleetSummary } from "@/lib/services/fleet";
import { emptySpeedViolationsSummary } from "@/lib/fleet/speed-violations-analytics";
import { parseDateRange } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to")
    );
    const sourceParam = searchParams.get("source");

    triggerGoogleSheetsSyncIfStale();

    const source = resolveDataSource(sourceParam);

    if (source === "google_sheets" && isGoogleSheetsConfigured()) {
      prefetchFleetDataset();
    } else if (source === "wialon" && isWialonReportConfigured()) {
      prefetchWialonFleetDataset(from, to);
    }

    if (isGoogleSheetsConfigured() || isWialonReportConfigured()) {
      const data = await loadDashboardBundle(from, to, source);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, max-age=30" },
      });
    }

    const [kpis, thefts, fleet] = await Promise.all([
      getKpiSummary(from, to),
      getFuelThefts(from, to, "all"),
      getFleetSummary(),
    ]);

    const distanceByUnit = new Map(
      thefts.fleetTable.map((row) => [row.unitId, row.distanceKm])
    );

    const unitLatest = fleet.units.map((unit) => ({
      unitId: unit.id,
      reg: unit.plateNumber ?? unit.name.split("—")[0]?.trim() ?? unit.name,
      name: unit.name,
      lastMessageAt: unit.lastMessageAt,
      locationLabel:
        unit.lastLat != null && unit.lastLon != null
          ? `${unit.lastLat.toFixed(4)}, ${unit.lastLon.toFixed(4)}`
          : null,
      lat: unit.lastLat,
      lon: unit.lastLon,
      speedKmh: unit.lastSpeedKmh ?? null,
      distanceKm: distanceByUnit.get(unit.id) ?? 0,
    }));

    return NextResponse.json({
      kpis,
      thefts,
      fleet,
      unitLatest,
      speedViolations: emptySpeedViolationsSummary(),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
