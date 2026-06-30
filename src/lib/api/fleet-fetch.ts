import type {
  DashboardBundle,
  DriverIncidentsResponse,
  SpeedViolationsSummary,
  UnitLatestRow,
} from "@/lib/types";
import type { SheetReportingDateRange } from "@/lib/google-sheets/date-range";
import { normalizeReportingRange } from "@/lib/google-sheets/reporting-date-range";

function buildQuery(from: string, to: string, extra?: Record<string, string>) {
  return new URLSearchParams({ from, to, ...extra }).toString();
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? fallback);
  }
  return res.json() as Promise<T>;
}

export async function fetchSheetDateRange(): Promise<SheetReportingDateRange> {
  const res = await fetch("/api/sheets/date-range");
  return readJson(res, "Failed to load sheet date range");
}

export async function fetchDashboard(
  from: string,
  to: string
): Promise<DashboardBundle> {
  const range = normalizeReportingRange(from, to);
  const res = await fetch(
    `/api/dashboard?${buildQuery(range.fromIso, range.toIso)}`
  );
  return readJson(res, "Failed to load dashboard");
}

export async function fetchDriverIncidents(
  from: string,
  to: string
): Promise<DriverIncidentsResponse> {
  const res = await fetch(`/api/driver-incidents?${buildQuery(from, to)}`);
  return readJson(res, "Failed to load incidents");
}

export async function fetchSpeedViolations(
  from: string,
  to: string
): Promise<SpeedViolationsSummary> {
  const res = await fetch(
    `/api/telematics/speed-violations?${buildQuery(from, to)}`
  );
  return readJson(res, "Failed to load speeding violations");
}

export async function fetchLiveUnitLocations(): Promise<UnitLatestRow[]> {
  const res = await fetch("/api/telematics/unit-locations");
  return readJson(res, "Failed to load unit locations");
}

/** @deprecated Use fetchLiveUnitLocations — live telematics is not date-scoped. */
export async function fetchUnitLocations(
  from: string,
  to: string
): Promise<UnitLatestRow[]> {
  void from;
  void to;
  return fetchLiveUnitLocations();
}
