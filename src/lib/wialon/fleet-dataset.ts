import {
  eachDayOfInterval,
  endOfDay,
  startOfDay,
} from "date-fns";
import { db } from "@/lib/db";
import { units } from "@/lib/db/schema";
import { wialonConfig } from "@/lib/config/env";
import { WialonClient, createWialonClient } from "@/lib/wialon/client";
import {
  parseWialonFleetReportRow,
  parseWialonSpeedingRow,
  parseWialonUnitLatestRow,
  wialonRowToStrings,
  type ParsedSpeedingRow,
} from "@/lib/wialon/parse-report";
import type { ParsedUnitLatestRow } from "@/lib/wialon/parse-report";
import type { WialonReportTable } from "@/lib/wialon/report-types";
import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";
import type { FleetDataset } from "@/lib/google-sheets/fleet-dataset";

const CACHE_TTL_MS = 5 * 60_000;
const SKIP_TABLE_LABELS = new Set(["fuel"]);

type CacheEntry = {
  dataset: FleetDataset;
  rangeKey: string;
};

let cache: CacheEntry | null = null;
let loadPromise: Promise<FleetDataset> | null = null;

function rangeKey(from: Date, to: Date): string {
  return `${startOfDay(from).toISOString()}|${startOfDay(to).toISOString()}`;
}

function dayInterval(reportDate: Date): { from: number; to: number } {
  const start = startOfDay(reportDate);
  const end = endOfDay(reportDate);
  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(end.getTime() / 1000),
  };
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

async function loadUnitIdMap(): Promise<Map<string, string>> {
  try {
    const rows = await db.select({ id: units.id, name: units.name }).from(units);
    return new Map(rows.map((row) => [row.name, row.id]));
  } catch {
    return new Map();
  }
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
  reportDate: Date,
  groupId: number
): Promise<{
  rows: ParsedKasuluFleetRow[];
  tables: WialonReportTable[];
}> {
  const { from, to } = dayInterval(reportDate);
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

function clampReportDays(from: Date, to: Date): Date[] {
  const maxDays = wialonConfig.reportMaxDays;
  const days = eachDayOfInterval({
    start: startOfDay(from),
    end: startOfDay(to),
  });

  if (days.length <= maxDays) return days;

  return days.slice(days.length - maxDays);
}

async function loadFromWialon(from: Date, to: Date): Promise<FleetDataset> {
  const client = createWialonClient();
  const groupId = Number(wialonConfig.reportGroupId);

  if (!client) {
    throw new Error("Wialon is not configured");
  }
  if (!groupId || !wialonConfig.reportResourceId || !wialonConfig.reportTemplateId) {
    throw new Error(
      "Wialon report IDs missing. Set WIALON_REPORT_RESOURCE_ID, WIALON_REPORT_TEMPLATE_ID, and WIALON_REPORT_GROUP_ID."
    );
  }

  const days = clampReportDays(from, to);
  const rows: ParsedKasuluFleetRow[] = [];
  const speedViolations: ParsedSpeedingRow[] = [];
  let unitLatestSnapshots: ParsedUnitLatestRow[] = [];

  try {
    await client.setLocale();

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const report = await fetchDayReport(client, day, groupId);
      rows.push(...report.rows);
      speedViolations.push(
        ...(await fetchSpeedingsFromTables(client, report.tables, day))
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

  return {
    rows,
    unitIds,
    fetchedAt: Date.now(),
    unitLatestSnapshots,
    speedViolations,
  };
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

  if (!loadPromise) {
    loadPromise = loadFromWialon(from, to)
      .then((dataset) => {
        cache = { dataset, rangeKey: key };
        return dataset;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

export function invalidateWialonFleetDatasetCache(): void {
  cache = null;
}

export function prefetchWialonFleetDataset(from: Date, to: Date): void {
  void getWialonFleetDataset(from, to).catch(() => undefined);
}
