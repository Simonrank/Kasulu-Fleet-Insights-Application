import type { ParsedSpeedingRow } from "@/lib/wialon/parse-report";
import type { SpeedViolationsSummary } from "@/lib/types";

export function emptySpeedViolationsSummary(): SpeedViolationsSummary {
  return {
    totalEvents: 0,
    totalMileageKm: 0,
    speedLimitsKmh: [],
    speedLimitLabel: null,
    byUnit: [],
    events: [],
  };
}

function buildSpeedLimitLabel(limits: number[]): string | null {
  if (limits.length === 0) return null;
  if (limits.length === 1) return `${limits[0]} km/h`;
  return `${limits[0]}–${limits[limits.length - 1]} km/h`;
}

export function buildSpeedViolationsSummary(
  rows: ParsedSpeedingRow[]
): SpeedViolationsSummary {
  if (rows.length === 0) {
    return emptySpeedViolationsSummary();
  }

  type UnitAgg = {
    unitName: string;
    count: number;
    maxSpeedKmh: number;
    totalDurationMinutes: number;
    mileageKm: number;
  };

  const byUnitMap = new Map<string, UnitAgg>();
  const limitSet = new Set<number>();

  for (const row of rows) {
    if (row.speedLimitKmh > 0) {
      limitSet.add(row.speedLimitKmh);
    }

    const current = byUnitMap.get(row.unitName) ?? {
      unitName: row.unitName,
      count: 0,
      maxSpeedKmh: 0,
      totalDurationMinutes: 0,
      mileageKm: 0,
    };

    current.count += 1;
    current.maxSpeedKmh = Math.max(current.maxSpeedKmh, row.speedKmh);
    current.totalDurationMinutes += row.durationMinutes;
    current.mileageKm += row.mileageKm;
    byUnitMap.set(row.unitName, current);
  }

  const byUnit = [...byUnitMap.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.maxSpeedKmh - a.maxSpeedKmh ||
      b.mileageKm - a.mileageKm
  );

  const events = rows.map((row, index) => ({
    id: `speed-${row.unitName}-${index}-${row.speedKmh}`,
    unitName: row.unitName,
    durationMinutes: row.durationMinutes,
    speedKmh: row.speedKmh,
    speedLimitKmh: row.speedLimitKmh,
    mileageKm: row.mileageKm,
    occurredAt: row.occurredAt?.toISOString() ?? null,
  }));

  const speedLimitsKmh = [...limitSet].sort((a, b) => a - b);

  return {
    totalEvents: rows.length,
    totalMileageKm: rows.reduce((sum, row) => sum + row.mileageKm, 0),
    speedLimitsKmh,
    speedLimitLabel: buildSpeedLimitLabel(speedLimitsKmh),
    byUnit,
    events,
  };
}
