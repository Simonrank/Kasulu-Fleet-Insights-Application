"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  DashboardBundle,
  DriverIncidentsResponse,
  FleetSummary,
  FuelTheftsResponse,
  KpiSummary,
  ReportSummary,
  SpeedViolationsSummary,
  TheftFilter,
  UnitLatestRow,
  UnitProblemsResponse,
  UtilizationSummary,
} from "@/lib/types";
import {
  fetchDashboard,
  fetchDriverIncidents,
  fetchLiveUnitLocations,
  fetchSheetDateRange,
  fetchSpeedViolations,
} from "@/lib/api/fleet-fetch";
import { fleetQueryKeys } from "@/lib/api/query-keys";

const SHEET_STALE_MS = 300_000;
const TELEMATICS_STALE_MS = 5 * 60_000;

/** Default reporting window from the fleet sheet `date` column. */
export function useSheetDateRange() {
  return useQuery({
    queryKey: fleetQueryKeys.sheetDateRange(),
    queryFn: fetchSheetDateRange,
    staleTime: SHEET_STALE_MS,
  });
}

/** Warm React Query cache — sheet dashboard + live locations; telematics on demand. */
export function prefetchFleetQueries(
  queryClient: QueryClient,
  from: string,
  to: string
): void {
  void queryClient.prefetchQuery({
    queryKey: fleetQueryKeys.unitLocationsLive(),
    queryFn: fetchLiveUnitLocations,
    staleTime: 30_000,
  });

  if (!from || !to) return;

  void queryClient.prefetchQuery({
    queryKey: fleetQueryKeys.dashboard(from, to),
    queryFn: () => fetchDashboard(from, to),
    staleTime: SHEET_STALE_MS,
  });

  const prefetchSpeed = () => {
    prefetchSpeedViolationsQuery(queryClient, from, to);
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => prefetchSpeed(), { timeout: 4000 });
  } else {
    setTimeout(prefetchSpeed, 1500);
  }
}

export function prefetchSpeedViolationsQuery(
  queryClient: QueryClient,
  from: string,
  to: string
): void {
  if (!from || !to) return;
  void queryClient.prefetchQuery({
    queryKey: fleetQueryKeys.speedViolations(from, to),
    queryFn: () => fetchSpeedViolations(from, to),
    staleTime: TELEMATICS_STALE_MS,
  });
}

export function prefetchDriverIncidentsQuery(
  queryClient: QueryClient,
  from: string,
  to: string
): void {
  if (!from || !to) return;
  void queryClient.prefetchQuery({
    queryKey: fleetQueryKeys.driverIncidents(from, to),
    queryFn: () => fetchDriverIncidents(from, to),
    staleTime: TELEMATICS_STALE_MS,
  });
}

/** Dashboard KPIs, thefts, fleet, and utilization — one Google Sheets request. */
export function useDashboard(from: string, to: string) {
  return useQuery<DashboardBundle>({
    queryKey: fleetQueryKeys.dashboard(from, to),
    queryFn: () => fetchDashboard(from, to),
    enabled: Boolean(from && to),
    staleTime: SHEET_STALE_MS,
    gcTime: 10 * 60_000,
    placeholderData: (previousData, previousQuery) => {
      const currentKey = fleetQueryKeys.dashboard(from, to);
      const prevKey = previousQuery?.queryKey;
      if (
        prevKey?.[0] === currentKey[0] &&
        prevKey?.[1] === currentKey[1] &&
        prevKey?.[2] === currentKey[2]
      ) {
        return previousData;
      }
      return undefined;
    },
    refetchOnMount: false,
    retry: 1,
  });
}

/** Speeding violations — live telematics, loaded separately from the sheet dashboard. */
export function useSpeedViolations(from: string, to: string, enabled = true) {
  return useQuery<SpeedViolationsSummary>({
    queryKey: fleetQueryKeys.speedViolations(from, to),
    enabled,
    queryFn: () => fetchSpeedViolations(from, to),
    staleTime: TELEMATICS_STALE_MS,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: false,
    placeholderData: (previousData, previousQuery) => {
      const currentKey = fleetQueryKeys.speedViolations(from, to);
      const prevKey = previousQuery?.queryKey;
      if (
        prevKey?.[0] === currentKey[0] &&
        prevKey?.[1] === currentKey[1] &&
        prevKey?.[2] === currentKey[2]
      ) {
        return previousData;
      }
      return undefined;
    },
  });
}

/** Current asset locations — live Wialon API, independent of sheet date range. */
export function useLiveUnitLocations() {
  return useQuery<UnitLatestRow[]>({
    queryKey: fleetQueryKeys.unitLocationsLive(),
    queryFn: fetchLiveUnitLocations,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnMount: true,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
}

/** @deprecated Use useLiveUnitLocations — live telematics is not date-scoped. */
export function useUnitLocations(from: string, to: string, enabled = true) {
  void from;
  void to;
  void enabled;
  return useLiveUnitLocations();
}

export function useKpis(from: string, to: string) {
  const { data, ...rest } = useDashboard(from, to);
  return { data: data?.kpis, ...rest };
}

/** Theft type is filtered client-side; `_type` kept for call-site clarity. */
export function useFuelThefts(from: string, to: string, _type: TheftFilter) {
  const { data, ...rest } = useDashboard(from, to);
  return { data: data?.thefts, ...rest };
}

/** Utilization is bundled with the dashboard — instant when that tab is prefetched. */
export function useUtilization(from: string, to: string) {
  const dashboard = useDashboard(from, to);
  return {
    ...dashboard,
    data: dashboard.data?.utilization as UtilizationSummary | undefined,
  };
}

export function useDriverIncidents(from: string, to: string) {
  return useQuery<DriverIncidentsResponse>({
    queryKey: fleetQueryKeys.driverIncidents(from, to),
    queryFn: () => fetchDriverIncidents(from, to),
    enabled: Boolean(from && to),
    staleTime: TELEMATICS_STALE_MS,
    gcTime: 10 * 60_000,
    placeholderData: (previousData, previousQuery) => {
      const currentKey = fleetQueryKeys.driverIncidents(from, to);
      const prevKey = previousQuery?.queryKey;
      if (
        prevKey?.[0] === currentKey[0] &&
        prevKey?.[1] === currentKey[1] &&
        prevKey?.[2] === currentKey[2]
      ) {
        return previousData;
      }
      return undefined;
    },
    refetchOnMount: false,
  });
}

export function useReports(from: string, to: string) {
  return useQuery<ReportSummary>({
    queryKey: fleetQueryKeys.reports(from, to),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, period: "weekly" });
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: Boolean(from && to),
    staleTime: SHEET_STALE_MS,
  });
}

export function useFleet() {
  return useQuery<FleetSummary>({
    queryKey: fleetQueryKeys.fleet(),
    queryFn: async () => {
      const res = await fetch("/api/fleet");
      if (!res.ok) throw new Error("Failed to load fleet");
      return res.json();
    },
    staleTime: SHEET_STALE_MS,
  });
}

export function useUnitProblems(
  unitId: string | null,
  from: string,
  to: string
) {
  return useQuery<UnitProblemsResponse>({
    queryKey: fleetQueryKeys.unitProblems(unitId ?? "", from, to),
    enabled: !!unitId,
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(
        `/api/fleet/${unitId}/problems?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to load unit problems");
      return res.json();
    },
  });
}

export { useQueryClient };
