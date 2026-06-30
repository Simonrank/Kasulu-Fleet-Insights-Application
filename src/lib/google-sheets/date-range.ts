import { endOfDay, startOfDay, subDays } from "date-fns";
import { googleSheetsConfig } from "@/lib/config/env";
import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";

export type SheetReportingDateRange = {
  /** Earliest calendar day in the sheet (yyyy-MM-dd). */
  minDate: string;
  /** Latest calendar day in the sheet (yyyy-MM-dd). */
  maxDate: string;
  defaultFrom: string;
  defaultTo: string;
  rowCount: number;
};

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Min/max and default reporting window from fleet sheet `date` column values. */
export function buildSheetReportingDateRange(
  rows: ParsedKasuluFleetRow[],
  windowDays = googleSheetsConfig.syncDays
): SheetReportingDateRange | null {
  if (!rows.length) return null;

  let min = rows[0]!.date;
  let max = rows[0]!.date;

  for (const row of rows) {
    if (row.date < min) min = row.date;
    if (row.date > max) max = row.date;
  }

  const minDay = startOfDay(min);
  const maxDay = startOfDay(max);
  const safeWindow = Math.max(1, windowDays);
  const windowStart = startOfDay(subDays(maxDay, safeWindow - 1));
  const defaultFromDay = windowStart < minDay ? minDay : windowStart;

  return {
    minDate: toDateInputValue(minDay),
    maxDate: toDateInputValue(maxDay),
    defaultFrom: startOfDay(defaultFromDay).toISOString(),
    defaultTo: endOfDay(maxDay).toISOString(),
    rowCount: rows.length,
  };
}
