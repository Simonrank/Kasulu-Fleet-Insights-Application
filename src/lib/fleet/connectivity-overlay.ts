import type { DashboardBundle, FleetSummary, FleetUnitRow, KpiSummary, UnitLatestRow } from "@/lib/types";
import {
  connectivityBand,
  isUnitUpdating,
  tallyConnectivityFromLastMessages,
} from "@/lib/fleet/connectivity";
import { internalUnitIdFromSheetKey } from "@/lib/google-sheets/parse";

function normalizeUnitKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findLiveRow(
  unitName: string,
  liveByKey: Map<string, UnitLatestRow>
): UnitLatestRow | undefined {
  const key = normalizeUnitKey(unitName);
  if (liveByKey.has(key)) return liveByKey.get(key);

  for (const [liveKey, row] of liveByKey) {
    if (key.includes(liveKey) || liveKey.includes(key)) return row;
  }

  const plate = unitName.split("—")[0]?.trim() ?? unitName;
  const plateKey = normalizeUnitKey(plate);
  return liveByKey.get(plateKey);
}

/** Fleet units + connectivity KPIs built purely from live telematics rows. */
export function buildLiveConnectivityState(
  liveRows: UnitLatestRow[],
  registeredUnitCount?: number
): { kpis: Pick<KpiSummary, "connectivityBands" | "updatingUnits" | "nonUpdatingUnits" | "totalUnits">; fleet: FleetSummary } {
  const units: FleetUnitRow[] = liveRows.map((row) => {
    const liveAt = row.lastMessageAt ? new Date(row.lastMessageAt) : null;
    const band = connectivityBand(liveAt);
    const updating = isUnitUpdating(liveAt);
    return {
      id: row.unitId,
      wialonId: internalUnitIdFromSheetKey(row.name),
      name: row.name,
      plateNumber: row.reg,
      vehicleType: null,
      category: "—",
      categoryKey: null,
      driverName: null,
      status: "active" as const,
      isOnline: updating,
      isUpdating: updating,
      connectivityBand: band,
      lastMessageAt: row.lastMessageAt,
      lastLat: row.lat,
      lastLon: row.lon,
      lastSpeedKmh: row.speedKmh,
    };
  });

  const connectivityBands = tallyConnectivityFromLastMessages(
    units.map((u) => (u.lastMessageAt ? new Date(u.lastMessageAt) : null))
  );
  const totalUnits = registeredUnitCount ?? liveRows.length;
  const unmatched = Math.max(0, totalUnits - liveRows.length);
  const connectivityBandsWithUnmatched = {
    ...connectivityBands,
    unknown: connectivityBands.unknown + unmatched,
  };
  const updatingUnits = connectivityBandsWithUnmatched.updating;

  return {
    kpis: {
      totalUnits,
      updatingUnits,
      nonUpdatingUnits: totalUnits - updatingUnits,
      connectivityBands: connectivityBandsWithUnmatched,
    },
    fleet: {
      units,
      summary: {
        total: totalUnits,
        byCategory: {},
        updating: updatingUnits,
        nonUpdating: totalUnits - updatingUnits,
        active: totalUnits,
        inactive: 0,
        maintenance: 0,
      },
    },
  };
}

/** Overlay Current Mobile Status timestamps onto fleet connectivity (live only). */
export function applyLiveMobileStatusToBundle(
  bundle: DashboardBundle,
  liveRows: UnitLatestRow[]
): DashboardBundle {
  const liveByKey = new Map<string, UnitLatestRow>();
  for (const row of liveRows) {
    liveByKey.set(normalizeUnitKey(row.name), row);
    if (row.reg !== row.name) {
      liveByKey.set(normalizeUnitKey(row.reg), row);
    }
  }

  const units = bundle.fleet.units.map((unit) => {
    const live = findLiveRow(unit.name, liveByKey);
    const liveAt = live?.lastMessageAt ? new Date(live.lastMessageAt) : null;

    const band = connectivityBand(liveAt);
    const updating = isUnitUpdating(liveAt);

    return {
      ...unit,
      lastMessageAt: liveAt?.toISOString() ?? null,
      connectivityBand: band,
      isUpdating: updating,
      isOnline: updating,
      lastLat: live?.lat ?? unit.lastLat,
      lastLon: live?.lon ?? unit.lastLon,
      lastSpeedKmh: live?.speedKmh ?? unit.lastSpeedKmh,
    };
  });

  const connectivityBands = tallyConnectivityFromLastMessages(
    units.map((u) => (u.lastMessageAt ? new Date(u.lastMessageAt) : null))
  );
  const updatingUnits = connectivityBands.updating;

  return {
    ...bundle,
    kpis: {
      ...bundle.kpis,
      updatingUnits,
      nonUpdatingUnits: bundle.kpis.totalUnits - updatingUnits,
      connectivityBands,
    },
    fleet: {
      ...bundle.fleet,
      summary: {
        ...bundle.fleet.summary,
        updating: updatingUnits,
        nonUpdating: bundle.kpis.totalUnits - updatingUnits,
      },
      units,
    },
  };
}
