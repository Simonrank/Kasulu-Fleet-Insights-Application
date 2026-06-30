import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { kpiTargets } from "@/lib/config/env";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDateRange(
  fromParam?: string | null,
  toParam?: string | null
): { from: Date; to: Date } {
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

export const VIOLATIONS_DEFAULT_HOURS = 24;

export function rollingViolationsFrom(to: Date): Date {
  return new Date(to.getTime() - VIOLATIONS_DEFAULT_HOURS * 60 * 60 * 1000);
}

export function defaultViolationsFromIso(toIso: string): string {
  const to = new Date(toIso);
  if (Number.isNaN(to.getTime())) {
    throw new Error("Invalid to date for violations window");
  }
  return rollingViolationsFrom(to).toISOString();
}

/** Rolling window for driver incidents — does not snap to calendar-day boundaries. */
export function parseDriverIncidentsDateRange(
  fromParam?: string | null,
  toParam?: string | null
): { from: Date; to: Date } {
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : rollingViolationsFrom(to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }

  return { from, to };
}

export function incidentWithinRange(
  occurredAtIso: string,
  from: Date,
  to: Date
): boolean {
  const t = new Date(occurredAtIso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`;
}

export const KPI_TARGETS = kpiTargets;

/** Average sheet-sourced km/L values (ignores zero rows). */
export function averageSheetMetric(values: number[]): number {
  const valid = values.filter((v) => v > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}
