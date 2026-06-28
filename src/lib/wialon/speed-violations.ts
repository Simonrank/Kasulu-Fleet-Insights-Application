import {
  eachDayOfInterval,
  endOfDay,
  startOfDay,
} from "date-fns";
import { isWialonReportConfigured, wialonConfig } from "@/lib/config/env";
import { WialonClient, createWialonClient } from "@/lib/wialon/client";
import {
  parseWialonSpeedingRow,
  wialonRowToStrings,
  type ParsedSpeedingRow,
} from "@/lib/wialon/parse-report";
import type { WialonReportTable } from "@/lib/wialon/report-types";

const CACHE_TTL_MS = 5 * 60_000;

type CacheEntry = {
  rows: ParsedSpeedingRow[];
  rangeKey: string;
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
let loadPromise: Promise<ParsedSpeedingRow[]> | null = null;

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

function clampReportDays(from: Date, to: Date): Date[] {
  const maxDays = wialonConfig.reportMaxDays;
  const days = eachDayOfInterval({
    start: startOfDay(from),
    end: startOfDay(to),
  });

  if (days.length <= maxDays) return days;
  return days.slice(days.length - maxDays);
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

async function loadSpeedViolations(
  from: Date,
  to: Date
): Promise<ParsedSpeedingRow[]> {
  const client = createWialonClient();
  const groupId = Number(wialonConfig.reportGroupId);

  if (!client || !groupId) return [];

  const days = clampReportDays(from, to);
  const rows: ParsedSpeedingRow[] = [];

  try {
    await client.setLocale();

    for (const day of days) {
      const { from: intervalFrom, to: intervalTo } = dayInterval(day);
      const result = await client.runGroupReport(intervalFrom, intervalTo, groupId);
      const tables = result.reportResult?.tables ?? [];
      const dayRows = await fetchSpeedingsFromTables(client, tables, day);
      rows.push(...dayRows);
    }
  } finally {
    await client.logout();
  }

  return rows;
}

/** Speeding violations from Wialon "Speedings" report for the reporting period. */
export async function getSpeedViolations(
  from: Date,
  to: Date
): Promise<ParsedSpeedingRow[]> {
  if (!isWialonReportConfigured()) return [];

  const key = rangeKey(from, to);

  if (
    cache &&
    cache.rangeKey === key &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.rows;
  }

  if (!loadPromise) {
    loadPromise = loadSpeedViolations(from, to)
      .then((rows) => {
        cache = { rows, rangeKey: key, fetchedAt: Date.now() };
        return rows;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

export function invalidateSpeedViolationsCache(): void {
  cache = null;
}
