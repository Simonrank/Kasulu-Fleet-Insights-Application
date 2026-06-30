import { loadUnitIdMap } from "@/lib/db/unit-id-map";
import { wialonConfig } from "@/lib/config/env";
import { WialonClient, createWialonClient } from "@/lib/wialon/client";
import {
  parseWialonFleetReportRow,
  parseWialonSpeedingRow,
  parseWialonUnitLatestRow,
  parseWialonViolationRow,
  wialonRowToStrings,
  type ParsedSpeedingRow,
  type ParsedWialonViolationRow,
} from "@/lib/wialon/parse-report";
import type { ParsedUnitLatestRow } from "@/lib/wialon/parse-report";
import type { WialonReportTable } from "@/lib/wialon/report-types";
import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";
import { getCategoryRegister } from "@/lib/fleet/category-register";
import {
  clampDarDays,
  darDayToDate,
  wialonUnixDayInterval,
  type DarCalendarDay,
} from "@/lib/wialon/day-interval";
import { withWialonSessionLock } from "@/lib/wialon/session-lock";
import { startOfDay } from "date-fns";

const CACHE_TTL_MS = 5 * 60_000;
const SKIP_TABLE_LABELS = new Set(["fuel"]);

type CacheEntry = {
  dataset: FleetDataset;
  rangeKey: string;
};

let cache: CacheEntry | null = null;
let loadPromise: { key: string; promise: Promise<FleetDataset> } | null = null;

function rangeKey(from: Date, to: Date): string {
  return `${startOfDay(from).toISOString()}|${startOfDay(to).toISOString()}`;
}


function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickFleetTable(tables: WialonReportTable[]): WialonReportTable | null {
  const preferred = wialonConfig.reportTableLabel?.trim().toLowerCase();

  if (preferred) {
    const match = tables.find((table) => {
      const label = (table.label ?? table.name ?? "").toLowerCase();
      return label.includes(preferred);
    });
    if (match) return match;
  }

  for (const table of tables) {
    const label = (table.label ?? table.name ?? "").toLowerCase();
    if (SKIP_TABLE_LABELS.has(label)) continue;

    const headers = (table.header ?? []).map(normalizeHeader);
    if (
      headers.some((header) =>
        ["unit", "name", "machine_id", "object", "registration"].includes(
          header
        )
      )
    ) {
      return table;
    }
  }

  return (
    tables.find((table) => {
      const label = (table.label ?? table.name ?? "").toLowerCase();
      return !SKIP_TABLE_LABELS.has(label) && (table.rows ?? 0) > 0;
    }) ?? null
  );
}

function pickUnitLatestTable(
  tables: WialonReportTable[]
): WialonReportTable | null {
  const match = tables.find((table) => {
    const label = (table.label ?? table.name ?? "").toLowerCase();
    return label.includes("unit latest");
  });
  return match ?? null;
}

function pickSpeedingsTable(
  tables: WialonReportTable[]
): WialonReportTable | null {
  return (
    tables.find((table) => {
      const label = (table.label ?? table.name ?? "").toLowerCase();
      return label.includes("speeding");
    }) ?? null
  );
}

function pickViolationsTable(
  tables: WialonReportTable[]
): WialonReportTable | null {
  return (
    tables.find((table) => {
      const label = (table.label ?? table.name ?? "").toLowerCase();
      return label.includes("violation") && !label.includes("speeding");
    }) ?? null
  );
}

async function fetchViolationsFromTables(
  client: WialonClient,
  tables: WialonReportTable[]
): Promise<ParsedWialonViolationRow[]> {
  const table = pickViolationsTable(tables);
  if (!table) return [];

  const tableIndex = tables.indexOf(table);
  const rawRows = await client.fetchTableRows(tableIndex, table);
  const headers = table.header ?? [];

  return rawRows
    .map((row) => parseWialonViolationRow(headers, wialonRowToStrings(row)))
    .filter((row): row is ParsedWialonViolationRow => row != null);
}

async function fetchSpeedingsFromTables(
  client: WialonClient,
  tables: WialonReportTable[],
  reportDate: Date
): Promise<ParsedSpeedingRow[]> {
  const table = pickSpeedingsTable(tables);
  if (!table) return [];

  const tableIndex = tables.indexOf(table);
  const rawRows = await client.fetchTableRows(tableIndex, table);
  const headers = table.header ?? [];

  return rawRows
    .map((row) =>
      parseWialonSpeedingRow(headers, wialonRowToStrings(row), reportDate)
    )
    .filter((row): row is ParsedSpeedingRow => row != null);
}

async function fetchDayReport(
  client: WialonClient,
  calendarDay: DarCalendarDay,
  groupId: number
): Promise<{
  rows: ParsedKasuluFleetRow[];
  tables: WialonReportTable[];
}> {
  const reportDate = darDayToDate(calendarDay);
  const { from, to } = wialonUnixDayInterval(calendarDay);
  const result = await client.runGroupReport(from, to, groupId);
  const tables = result.reportResult?.tables ?? [];
  const table = pickFleetTable(tables);

  if (!table) {
    return { rows: [], tables };
  }

  const tableIndex = tables.indexOf(table);
  const rawRows = await client.fetchTableRows(tableIndex, table);
  const headers = table.header ?? [];

  const rows = rawRows
    .map((row) =>
      parseWialonFleetReportRow(headers, wialonRowToStrings(row), reportDate)
    )
    .filter((row): row is ParsedKasuluFleetRow => row != null);

  return { rows, tables };
}

async function fetchUnitLatestFromTables(
  client: WialonClient,
  tables: WialonReportTable[]
): Promise<ParsedUnitLatestRow[]> {
  const table = pickUnitLatestTable(tables);
  if (!table) return [];

  const tableIndex = tables.indexOf(table);
  const rawRows = await client.fetchTableRows(tableIndex, table);
  const headers = table.header ?? [];

  return rawRows
    .map((row) => parseWialonUnitLatestRow(headers, wialonRowToStrings(row)))
    .filter((row): row is ParsedUnitLatestRow => row != null);
}


async function loadFromWialon(from: Date, to: Date): Promise<FleetDataset> {
  return withWialonSessionLock(async () => {
    const client = createWialonClient();
    const groupId = Number(wialonConfig.reportGroupId);

    if (!client) {
      throw new Error("Live telematics is not configured");
    }
    if (
      !groupId ||
      !wialonConfig.reportResourceId ||
      !wialonConfig.reportTemplateId
    ) {
      throw new Error(
        "Telematics report IDs missing. Set WIALON_REPORT_RESOURCE_ID, WIALON_REPORT_TEMPLATE_ID, and WIALON_REPORT_GROUP_ID."
      );
    }

    const days = clampDarDays(from, to, wialonConfig.reportMaxDays);
    const rows: ParsedKasuluFleetRow[] = [];
    const speedViolations: ParsedSpeedingRow[] = [];
    const wialonViolations: ParsedWialonViolationRow[] = [];
    let unitLatestSnapshots: ParsedUnitLatestRow[] = [];

    try {
      await client.setLocale();

      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const reportDate = darDayToDate(day);
        const report = await fetchDayReport(client, day, groupId);
        rows.push(...report.rows);
        speedViolations.push(
          ...(await fetchSpeedingsFromTables(client, report.tables, reportDate))
        );
        wialonViolations.push(
          ...(await fetchViolationsFromTables(client, report.tables))
        );

        if (i === days.length - 1) {
          unitLatestSnapshots = await fetchUnitLatestFromTables(
            client,
            report.tables
          );
        }
      }
    } finally {
      await client.logout();
    }

    const unitIds = await loadUnitIdMap();
    const categoryRegister = await getCategoryRegister();

    return {
      rows,
      unitIds,
      fetchedAt: Date.now(),
      categoryRegister,
      unitLatestSnapshots,
      speedViolations,
      wialonViolations,
    };
  });
}

/** Live fleet rows from Wialon reports for the selected reporting period. */
export async function getWialonFleetDataset(
  from: Date,
  to: Date
): Promise<FleetDataset> {
  const key = rangeKey(from, to);

  if (cache && cache.rangeKey === key && Date.now() - cache.dataset.fetchedAt < CACHE_TTL_MS) {
    return cache.dataset;
  }

  if (loadPromise?.key === key) {
    return loadPromise.promise;
  }

  const promise = loadFromWialon(from, to)
    .then((dataset) => {
      cache = { dataset, rangeKey: key };
      return dataset;
    })
    .finally(() => {
      if (loadPromise?.key === key) {
        loadPromise = null;
      }
    });

  loadPromise = { key, promise };
  return promise;
}

export function invalidateWialonFleetDatasetCache(): void {
  cache = null;
}

export function prefetchWialonFleetDataset(from: Date, to: Date): void {
  void getWialonFleetDataset(from, to).catch(() => undefined);
}
