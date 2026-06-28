import type {
  DashboardBundle,
  DriverIncidentsResponse,
  SpeedViolationsSummary,
  UnitLatestRow,
} from "@/lib/types";

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

export async function fetchDashboard(
  from: string,
  to: string
): Promise<DashboardBundle> {
  const res = await fetch(`/api/dashboard?${buildQuery(from, to)}`);
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

export async function fetchUnitLocations(
  from: string,
  to: string
): Promise<UnitLatestRow[]> {
  const res = await fetch(
    `/api/telematics/unit-locations?${buildQuery(from, to)}`
  );
  return readJson(res, "Failed to load unit locations");
}
