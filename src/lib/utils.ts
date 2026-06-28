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
