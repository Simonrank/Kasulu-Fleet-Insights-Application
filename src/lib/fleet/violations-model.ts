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
  const volumeMatch = text.match(/drain of ([\d.]+)\s*l/i);
  return {
    value: speedMatch
      ? parseFloat(speedMatch[1])
      : volumeMatch
        ? parseFloat(volumeMatch[1])
        : null,
    threshold: thresholdMatch ? parseFloat(thresholdMatch[1]) : null,
  };
}

export function wialonViolationsToIncidents(
  rows: ParsedWialonViolationRow[],
  unitIds: Map<string, string>
): DriverIncidentRow[] {
  const incidents: DriverIncidentRow[] = [];

  for (const [index, row] of rows.entries()) {
    const { key, label } = violationTypeFromText(row.violationText);
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
