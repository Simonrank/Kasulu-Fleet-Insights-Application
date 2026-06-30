import {
  isMobileStatusConfigured,
  wialonConfig,
} from "@/lib/config/env";
import type { UnitLatestRow } from "@/lib/types";
import { createWialonClient } from "@/lib/wialon/client";
import { darCalendarParts, wialonUnixDayInterval } from "@/lib/wialon/day-interval";
import {
  parseWialonMobileStatusRow,
  wialonRowToStrings,
} from "@/lib/wialon/parse-report";
import type { WialonReportTable } from "@/lib/wialon/report-types";
import { withWialonSessionLock } from "@/lib/wialon/session-lock";

const CACHE_TTL_MS = 60_000;

let cache: { rows: UnitLatestRow[]; fetchedAt: number } | null = null;
let loadPromise: Promise<UnitLatestRow[]> | null = null;

function pickMobileStatusTable(
  tables: WialonReportTable[]
): WialonReportTable | null {
  const preferred = wialonConfig.mobileStatusTableLabel.trim().toLowerCase();

  if (preferred) {
    const match = tables.find((table) => {
      const label = (table.label ?? table.name ?? "").toLowerCase();
      return label.includes(preferred);
    });
    if (match) return match;
  }

  const match = tables.find((table) => {
    const label = (table.label ?? table.name ?? "").toLowerCase();
    return (
      label.includes("mobile status") ||
      label.includes("controlroom") ||
      label.includes("control room")
    );
  });

  if (match) return match;

  return (
    tables.find((table) => (table.rows ?? 0) > 0) ??
    tables[0] ??
    null
  );
}

function mobileStatusObjectId(): number {
  const objectId = Number(
    wialonConfig.mobileStatusObjectId || wialonConfig.reportGroupId
  );
  if (!objectId) {
    throw new Error(
      "Set WIALON_MOBILE_STATUS_OBJECT_ID (unit group) for the Current Mobile Status report."
    );
  }
  return objectId;
}

function toUnitLatestRows(
  parsed: ReturnType<typeof parseWialonMobileStatusRow>[]
): UnitLatestRow[] {
  return parsed
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) => ({
      unitId: row.asset.trim().toLowerCase().replace(/\s+/g, "-"),
      reg: row.asset,
      name: row.asset,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      locationLabel: row.location,
      lat: row.lat,
      lon: row.lon,
      speedKmh: row.speedKmh,
      distanceKm: 0,
    }))
    .sort((a, b) => {
      const speedA = a.speedKmh ?? -1;
      const speedB = b.speedKmh ?? -1;
      if (speedB !== speedA) return speedB - speedA;
      return a.reg.localeCompare(b.reg);
    });
}

async function loadMobileStatusFromWialon(): Promise<UnitLatestRow[]> {
  return withWialonSessionLock(async () => {
    const client = createWialonClient(false);
    if (!client) {
      throw new Error("Wialon token is not configured");
    }

    const resourceId = Number(wialonConfig.mobileStatusResourceId);
    const templateId = Number(wialonConfig.mobileStatusTemplateId);
    const objectId = mobileStatusObjectId();

    const today = darCalendarParts(new Date());
    const { from: dayStart } = wialonUnixDayInterval(today);
    const to = Math.floor(Date.now() / 1000);

    try {
      await client.setLocale();

      const result = await client.runGroupReport(dayStart, to, objectId, {
        resourceId,
        templateId,
      });

      const tables = result.reportResult?.tables ?? [];
      const table = pickMobileStatusTable(tables);

      if (!table) {
        return [];
      }

      const tableIndex = tables.indexOf(table);
      const rawRows = await client.fetchTableRows(tableIndex, table);
      const headers = table.header ?? [];

      return toUnitLatestRows(
        rawRows.map((row) =>
          parseWialonMobileStatusRow(headers, wialonRowToStrings(row))
        )
      );
    } finally {
      await client.logout();
    }
  });
}

/** Live rows from Wialon "Current Mobile Status - ControlRoom" report. */
export async function getMobileStatusRows(): Promise<UnitLatestRow[]> {
  if (!isMobileStatusConfigured()) {
    return [];
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }

  if (!loadPromise) {
    loadPromise = loadMobileStatusFromWialon()
      .then((rows) => {
        cache = { rows, fetchedAt: Date.now() };
        return rows;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

export function invalidateMobileStatusCache(): void {
  cache = null;
}

export function prefetchMobileStatus(): void {
  if (!isMobileStatusConfigured()) return;
  void getMobileStatusRows().catch(() => undefined);
}
