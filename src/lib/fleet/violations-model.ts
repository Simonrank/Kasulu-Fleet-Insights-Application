import type { ParsedSpeedingRow, ParsedWialonViolationRow } from "@/lib/wialon/parse-report";
import { extractLocationFromViolationText } from "@/lib/wialon/parse-report";
import { colorFromKey } from "@/lib/data-driven/colors";
import { applyDatasetSeverity } from "@/lib/data-driven/severity";
import type { DriverIncidentRow, FuelTheftDetail, ViolationsSummary } from "@/lib/types";

const typeLabels = new Map<string, string>();

export function registerTypeLabel(key: string, label: string): void {
  if (!typeLabels.has(key)) typeLabels.set(key, label);
}

export function incidentTypeLabel(type: string): string {
  return typeLabels.get(type) ?? type.replace(/_/g, " ");
}

export function violationTypeFromText(text: string): {
  key: string;
  label: string;
} {
  const label = text.split("\n")[0]?.trim() || text.trim() || "Violation";
  const key =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "violation";
  registerTypeLabel(key, label);
  return { key, label };
}

export function emptyViolationsSummary(): ViolationsSummary {
  return {
    total: 0,
    byType: {},
    bySeverity: {},
    topUnits: [],
    criticalCount: 0,
  };
}

function parseNumbersFromText(text: string): {
  value: number | null;
  threshold: number | null;
} {
  const thresholdMatch = text.match(/above\s+([\d.]+)\s*km/i);
  const speedMatch = text.match(/speed of\s+([\d.]+)\s*km/i);
  return {
    value: speedMatch ? parseFloat(speedMatch[1]) : null,
    threshold: thresholdMatch ? parseFloat(thresholdMatch[1]) : null,
  };
}

/** Fuel drains belong on the Fuel Thefts tab, not driver incidents. */
export function isFuelDrainViolationText(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("fuel drain") ||
    lower.includes("tank drain") ||
    /drain\s+of\s+[\d.]+\s*l/i.test(lower) ||
    (lower.includes("drain") && lower.includes("fuel"))
  );
}

export function isFuelDrainViolation(row: DriverIncidentRow): boolean {
  return isFuelDrainViolationText(
    `${row.description ?? ""} ${incidentTypeLabel(row.incidentType)}`
  );
}

export function wialonViolationsToIncidents(
  rows: ParsedWialonViolationRow[],
  unitIds: Map<string, string>
): DriverIncidentRow[] {
  const incidents: DriverIncidentRow[] = [];

  for (const [index, row] of rows.entries()) {
    if (isFuelDrainViolationText(row.violationText)) continue;

    const { key } = violationTypeFromText(row.violationText);
    const numbers = parseNumbersFromText(row.violationText);
    const occurredAt =
      row.occurredAt?.toISOString() ??
      row.timeReceived?.toISOString() ??
      null;

    if (!occurredAt) continue;

    incidents.push({
      id: `live-violation-${row.unitName}-${occurredAt}-${index}`,
      unitId: unitIds.get(row.unitName) ?? row.unitName,
      unitName: row.unitName,
      driverName: null,
      incidentType: key,
      severity: "low",
      value: numbers.value,
      threshold: numbers.threshold,
      occurredAt,
      locationName: extractLocationFromViolationText(row.violationText),
      description: row.violationText.split("\n")[0]?.trim() || row.violationText,
      durationMinutes: null,
      source: "live_violations",
    });
  }

  return incidents;
}

export function speedingsToIncidents(
  rows: ParsedSpeedingRow[],
  unitIds: Map<string, string>
): DriverIncidentRow[] {
  const incidents: DriverIncidentRow[] = [];

  for (const [index, row] of rows.entries()) {
    const occurredAt = row.occurredAt?.toISOString() ?? null;
    if (!occurredAt) continue;

    const limit = row.speedLimitKmh > 0 ? row.speedLimitKmh : null;
    const parts: string[] = [];
    if (row.speedKmh > 0) parts.push(`${row.speedKmh} km/h`);
    if (limit != null) parts.push(`limit ${limit} km/h`);
    if (row.durationMinutes > 0) parts.push(`${row.durationMinutes} min`);

    const description = parts.join(" · ");
    const { key } = violationTypeFromText(description || "Speeding");

    incidents.push({
      id: `live-speeding-${row.unitName}-${occurredAt}-${index}-${row.speedKmh}`,
      unitId: unitIds.get(row.unitName) ?? row.unitName,
      unitName: row.unitName,
      driverName: null,
      incidentType: key,
      severity: "low",
      value: row.speedKmh > 0 ? row.speedKmh : null,
      threshold: limit,
      occurredAt,
      locationName: null,
      description,
      durationMinutes: row.durationMinutes,
      source: "live_speedings",
    });
  }

  return incidents;
}

export function sheetFuelTheftsToIncidents(
  events: FuelTheftDetail[]
): DriverIncidentRow[] {
  return events.map((event) => {
    const label = event.description?.trim() || "Fuel theft";
    const { key } = violationTypeFromText(label);
    return {
      id: `sheet-fuel-${event.id}`,
      unitId: event.unitId,
      unitName: event.unitName,
      driverName: null,
      incidentType: key,
      severity: "low",
      value: event.volumeLiters,
      threshold: null,
      occurredAt: event.occurredAt,
      locationName: event.locationName,
      description: event.description,
      durationMinutes: event.durationMinutes,
    };
  });
}

function incidentDedupeKey(row: DriverIncidentRow): string {
  const day = row.occurredAt.slice(0, 10);
  return `${row.unitName}|${row.incidentType}|${day}|${row.value ?? ""}|${row.description?.slice(0, 40) ?? ""}`;
}

export function mergeViolationSources(
  ...groups: DriverIncidentRow[][]
): DriverIncidentRow[] {
  const merged: DriverIncidentRow[] = [];
  const keys = new Set<string>();

  for (const group of groups) {
    for (const row of group) {
      const key = incidentDedupeKey(row);
      if (keys.has(key)) continue;
      keys.add(key);
      merged.push(row);
    }
  }

  return merged.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export function applyDataDrivenSeverity(
  rows: DriverIncidentRow[]
): DriverIncidentRow[] {
  return applyDatasetSeverity(rows);
}

export function buildViolationsSummary(
  incidents: DriverIncidentRow[]
): ViolationsSummary {
  if (incidents.length === 0) return emptyViolationsSummary();

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byUnit = new Map<string, number>();

  for (const row of incidents) {
    byType[row.incidentType] = (byType[row.incidentType] ?? 0) + 1;
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
    byUnit.set(row.unitName, (byUnit.get(row.unitName) ?? 0) + 1);
  }

  const topUnits = [...byUnit.entries()]
    .map(([unitName, count]) => ({ unitName, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: incidents.length,
    byType,
    bySeverity,
    topUnits,
    criticalCount: bySeverity.critical ?? 0,
  };
}

export function incidentTypesFromData(
  incidents: DriverIncidentRow[]
): string[] {
  return [...new Set(incidents.map((row) => row.incidentType))].sort();
}

export function incidentDurationSeconds(row: DriverIncidentRow): number {
  if (row.durationMinutes != null && row.durationMinutes > 0) {
    return Math.round(row.durationMinutes * 60);
  }
  return 0;
}

export function incidentEndTime(row: DriverIncidentRow): Date | null {
  const seconds = incidentDurationSeconds(row);
  if (seconds <= 0) return null;
  return new Date(new Date(row.occurredAt).getTime() + seconds * 1000);
}

export function formatDurationHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type ViolationTypeSummary = {
  type: string;
  label: string;
  count: number;
  totalDurationSeconds: number;
};

/** Speed bands for overview cards — ordered high to low. */
export const SPEED_VIOLATION_BUCKETS = [
  { key: "speed_gte_80", label: "≥ 80 km/h", minInclusive: 80 },
  { key: "speed_60_80", label: "60–80 km/h", minInclusive: 60, maxExclusive: 80 },
  { key: "speed_35_60", label: "35–60 km/h", minInclusive: 35, maxExclusive: 60 },
  { key: "speed_lt_35", label: "< 35 km/h", maxExclusive: 35 },
] as const;

export const OTHER_VIOLATIONS_GROUP = "other_violations";

/** Parsed speed (km/h) when the incident row represents a speed event. */
export function incidentSpeedKmh(row: DriverIncidentRow): number | null {
  if (row.value == null || row.value <= 0) return null;

  if (row.source === "live_speedings") {
    return row.value;
  }

  if (row.source === "live_violations") {
    const desc = row.description ?? "";
    if (row.threshold != null || /speed of\s+[\d.]+/i.test(desc)) {
      return row.value;
    }
  }

  return null;
}

export function speedBucketKey(speedKmh: number): string {
  if (speedKmh >= 80) return "speed_gte_80";
  if (speedKmh >= 60) return "speed_60_80";
  if (speedKmh >= 35) return "speed_35_60";
  return "speed_lt_35";
}

export function violationGroupKey(row: DriverIncidentRow): string {
  const speed = incidentSpeedKmh(row);
  if (speed != null) return speedBucketKey(speed);
  return OTHER_VIOLATIONS_GROUP;
}

export function violationGroupLabel(groupKey: string): string {
  const bucket = SPEED_VIOLATION_BUCKETS.find((b) => b.key === groupKey);
  if (bucket) return bucket.label;
  if (groupKey === OTHER_VIOLATIONS_GROUP) return "Other violations";
  return incidentTypeLabel(groupKey);
}

export function matchesViolationGroup(
  row: DriverIncidentRow,
  groupKey: string
): boolean {
  return violationGroupKey(row) === groupKey;
}

const GROUP_CARD_ORDER = [
  ...SPEED_VIOLATION_BUCKETS.map((b) => b.key),
  OTHER_VIOLATIONS_GROUP,
];

export function summarizeViolationGroups(
  incidents: DriverIncidentRow[]
): ViolationTypeSummary[] {
  const byGroup = new Map<string, ViolationTypeSummary>();

  for (const row of incidents) {
    const key = violationGroupKey(row);
    const existing = byGroup.get(key) ?? {
      type: key,
      label: violationGroupLabel(key),
      count: 0,
      totalDurationSeconds: 0,
    };
    existing.count += 1;
    existing.totalDurationSeconds += incidentDurationSeconds(row);
    byGroup.set(key, existing);
  }

  return GROUP_CARD_ORDER.filter((key) => byGroup.has(key)).map(
    (key) => byGroup.get(key)!
  );
}

export function violationTypeColor(type: string, index = 0): string {
  return colorFromKey(type, index);
}

export function totalIncidentDurationSeconds(
  incidents: DriverIncidentRow[]
): number {
  return incidents.reduce(
    (sum, row) => sum + incidentDurationSeconds(row),
    0
  );
}

export function summarizeViolationTypes(
  incidents: DriverIncidentRow[]
): ViolationTypeSummary[] {
  const byType = new Map<string, ViolationTypeSummary>();

  for (const row of incidents) {
    const existing = byType.get(row.incidentType) ?? {
      type: row.incidentType,
      label: incidentTypeLabel(row.incidentType),
      count: 0,
      totalDurationSeconds: 0,
    };
    existing.count += 1;
    existing.totalDurationSeconds += incidentDurationSeconds(row);
    byType.set(row.incidentType, existing);
  }

  return [...byType.values()].sort((a, b) => b.count - a.count);
}
