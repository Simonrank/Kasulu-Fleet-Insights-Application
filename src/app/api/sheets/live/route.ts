import { NextResponse } from "next/server";
import { fetchSheetRange } from "@/lib/google-sheets/client";
import { googleSheetsConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import {
  headerIndexMap,
  parseKasuluFleetRow,
} from "@/lib/google-sheets/parse";

/** Live health check — reads Google Sheet directly (no DB). */
export async function GET() {
  if (!isGoogleSheetsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_SHEETS_SPREADSHEET_ID not set" },
      { status: 503 }
    );
  }

  try {
    const rows = await fetchSheetRange(googleSheetsConfig.ranges.fleet);
    const map = headerIndexMap(rows[0] ?? []);

    const latestByMachine = new Map<
      string,
      ReturnType<typeof parseKasuluFleetRow> & object
    >();

    for (const row of rows.slice(1)) {
      const parsed = parseKasuluFleetRow(row, map);
      if (!parsed) continue;
      const prev = latestByMachine.get(parsed.machineId);
      if (!prev || parsed.date > prev.date) {
        latestByMachine.set(parsed.machineId, parsed);
      }
    }

    const sample = [...latestByMachine.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map((r) => ({
        machineId: r.machineId,
        date: r.date.toISOString(),
        lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
        mileage: r.distanceKm,
        engineHours: r.engineHours,
        fuelConsumed: r.fuelConsumedLiters,
        fuelTheft: r.fuelTheftLiters,
        comment: r.comment,
      }));

    return NextResponse.json({
      ok: true,
      spreadsheetId: googleSheetsConfig.spreadsheetId,
      range: googleSheetsConfig.ranges.fleet,
      totalRows: Math.max(0, rows.length - 1),
      machines: latestByMachine.size,
      fetchedAt: new Date().toISOString(),
      sample,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sheet read failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
