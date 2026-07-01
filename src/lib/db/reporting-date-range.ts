import { endOfDay, startOfDay, subDays } from "date-fns";
import { min, max, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyUnitMetrics } from "@/lib/db/schema";
import { googleSheetsConfig } from "@/lib/config/env";
import type { SheetReportingDateRange } from "@/lib/google-sheets/date-range";

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Min/max/default reporting window from synced daily metrics in Postgres. */
export async function getDbReportingDateRange(): Promise<SheetReportingDateRange | null> {
  const [bounds, rowTotal] = await Promise.all([
    db
      .select({
        minDate: min(dailyUnitMetrics.date),
        maxDate: max(dailyUnitMetrics.date),
      })
      .from(dailyUnitMetrics),
    db.select({ total: count() }).from(dailyUnitMetrics),
  ]);

  const minRaw = bounds[0]?.minDate;
  const maxRaw = bounds[0]?.maxDate;
  const rowCount = Number(rowTotal[0]?.total ?? 0);

  if (!minRaw || !maxRaw || rowCount === 0) return null;

  const minDay = startOfDay(minRaw);
  const maxDay = startOfDay(maxRaw);
  const windowDays = Math.max(1, googleSheetsConfig.syncDays);
  const windowStart = startOfDay(subDays(maxDay, windowDays - 1));
  const defaultFromDay = windowStart < minDay ? minDay : windowStart;

  return {
    minDate: toDateInputValue(minDay),
    maxDate: toDateInputValue(maxDay),
    defaultFrom: startOfDay(defaultFromDay).toISOString(),
    defaultTo: endOfDay(maxDay).toISOString(),
    rowCount,
  };
}

export async function hasSyncedMetrics(): Promise<boolean> {
  const [result] = await db.select({ total: count() }).from(dailyUnitMetrics);
  return Number(result?.total ?? 0) > 0;
}
