import { startOfDay } from "date-fns";

/**
 * Dashboard KPI / theft aggregation — calendar-day boundaries (startOfDay).
 * Used by buildDashboardFromSheet.
 */
export function rowInReportingDayRange(
  date: Date,
  from: Date,
  to: Date
): boolean {
  const d = startOfDay(date).getTime();
  return d >= startOfDay(from).getTime() && d <= startOfDay(to).getTime();
}

/**
 * Utilization aggregation — inclusive datetime window (from/to already normalized by API).
 * Used by buildUtilizationFromDataset.
 */
export function rowInDatetimeRange(
  date: Date,
  from: Date,
  to: Date
): boolean {
  return date >= from && date <= to;
}
