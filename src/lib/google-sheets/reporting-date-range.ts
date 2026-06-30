import {
  darCalendarParts,
  wialonUnixDayInterval,
  type DarCalendarDay,
} from "@/lib/wialon/day-interval";
import { format } from "date-fns";

/** Compact YYYYMMDD key for Dar es Salaam calendar-day comparisons. */
export function darDayKey(parts: DarCalendarDay): number {
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function darDayFromParts(parts: DarCalendarDay): Date {
  return new Date(wialonUnixDayInterval(parts).from * 1000);
}

function formatDarDay(parts: DarCalendarDay): string {
  return format(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day)),
    "d MMM yyyy"
  );
}

/**
 * Normalize analysis-window bounds to Dar calendar days (Africa/Dar_es_Salaam).
 * Matches how fleet sheet rows are reported in the field.
 */
export function parseReportingDateRange(
  fromParam?: string | null,
  toParam?: string | null
): { from: Date; to: Date } {
  const toInput = toParam ? new Date(toParam) : new Date();
  const fromInput = fromParam
    ? new Date(fromParam)
    : new Date(toInput.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(fromInput.getTime()) || Number.isNaN(toInput.getTime())) {
    throw new Error("Invalid date range");
  }

  const fromInterval = wialonUnixDayInterval(darCalendarParts(fromInput));
  const toInterval = wialonUnixDayInterval(darCalendarParts(toInput));

  return {
    from: new Date(fromInterval.from * 1000),
    to: new Date(toInterval.to * 1000),
  };
}

export function normalizeReportingRange(
  fromIso: string,
  toIso: string
): { fromIso: string; toIso: string; from: Date; to: Date } {
  const { from, to } = parseReportingDateRange(fromIso, toIso);
  return { fromIso: from.toISOString(), toIso: to.toISOString(), from, to };
}

export function isSameReportingDay(fromIso: string, toIso: string): boolean {
  const { from, to } = parseReportingDateRange(fromIso, toIso);
  return (
    darDayKey(darCalendarParts(from)) === darDayKey(darCalendarParts(to))
  );
}

/** End of the Dar calendar day containing `fromIso`. */
export function reportingDayEndIso(fromIso: string): string {
  const { to } = parseReportingDateRange(fromIso, fromIso);
  return to.toISOString();
}

export function formatReportingPeriodLabel(fromIso: string, toIso: string): string {
  const { from, to } = parseReportingDateRange(fromIso, toIso);
  const start = darCalendarParts(from);
  const end = darCalendarParts(to);
  if (darDayKey(start) === darDayKey(end)) {
    return formatDarDay(start);
  }
  return `${formatDarDay(start)} – ${formatDarDay(end)}`;
}

/** Inclusive Dar calendar-day filter for sheet KPI / theft rows. */
export function rowInReportingDayRange(
  date: Date,
  from: Date,
  to: Date
): boolean {
  const d = darDayKey(darCalendarParts(date));
  const start = darDayKey(darCalendarParts(from));
  const end = darDayKey(darCalendarParts(to));
  return d >= start && d <= end;
}

export function subtractDarDays(parts: DarCalendarDay, days: number): DarCalendarDay {
  const cursor = Date.UTC(parts.year, parts.month - 1, parts.day);
  const shifted = new Date(cursor - days * 86400000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function presetReportingRange(
  preset: "today" | "7d" | "30d",
  anchorToIso: string,
  minDateIso?: string
): { from: string; to: string } {
  const anchor = darCalendarParts(new Date(anchorToIso));
  let fromParts = anchor;

  if (preset === "7d") fromParts = subtractDarDays(anchor, 6);
  if (preset === "30d") fromParts = subtractDarDays(anchor, 29);

  if (minDateIso) {
    const minParts = darCalendarParts(new Date(minDateIso));
    if (darDayKey(fromParts) < darDayKey(minParts)) {
      fromParts = minParts;
    }
  }

  const from = darDayFromParts(fromParts);
  const to = new Date(wialonUnixDayInterval(anchor).to * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}
