export { rowInReportingDayRange } from "@/lib/google-sheets/reporting-date-range";

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
