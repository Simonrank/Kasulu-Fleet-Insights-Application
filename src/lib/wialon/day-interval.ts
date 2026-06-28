/** Africa/Dar_es_Salaam — fixed UTC+3 (no DST). Matches the Python daily report script. */
const TZ_OFFSET_SEC = 3 * 3600;

export type DarCalendarDay = {
  year: number;
  month: number;
  day: number;
};

export function darCalendarParts(date: Date): DarCalendarDay {
  const shifted = new Date(date.getTime() + TZ_OFFSET_SEC * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function wialonUnixDayInterval(calendar: DarCalendarDay): {
  from: number;
  to: number;
} {
  const { year, month, day } = calendar;
  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0) - TZ_OFFSET_SEC * 1000;
  const endMs = Date.UTC(year, month - 1, day, 23, 59, 59) - TZ_OFFSET_SEC * 1000;
  return {
    from: Math.floor(startMs / 1000),
    to: Math.floor(endMs / 1000),
  };
}

export function darDayToDate(calendar: DarCalendarDay): Date {
  const { from } = wialonUnixDayInterval(calendar);
  return new Date(from * 1000);
}

export function eachDarDayInRange(from: Date, to: Date): DarCalendarDay[] {
  const start = darCalendarParts(from);
  const end = darCalendarParts(to);
  const days: DarCalendarDay[] = [];

  let cursor = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);

  while (cursor <= endMs) {
    const d = new Date(cursor);
    days.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    });
    cursor += 86400000;
  }

  return days;
}

export function clampDarDays(
  from: Date,
  to: Date,
  maxDays: number
): DarCalendarDay[] {
  const days = eachDarDayInRange(from, to);
  if (days.length <= maxDays) return days;
  return days.slice(days.length - maxDays);
}
