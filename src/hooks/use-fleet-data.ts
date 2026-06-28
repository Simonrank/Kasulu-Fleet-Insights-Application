"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  DashboardBundle,
  KpiSummary,
  FuelTheftsResponse,
  DriverIncidentsResponse,
  ReportSummary,
  UtilizationSummary,
  FleetSummary,
  UnitProblemsResponse,
  TheftFilter,
  SpeedViolationsSummary,
  UnitLatestRow,
} from "@/lib/types";
import {
  fetchDashboard,
  fetchDriverIncidents,
  fetchSpeedViolations,
  fetchUnitLocations,
} from "@/lib/api/fleet-fetch";

const SHEET_STALE_MS = 120_000;
const TELEMATICS_STALE_MS = 5 * 60_000;

/** Warm React Query cache for the main tabs (call on mount / nav hover). */
export function prefetchFleetQueries(
  queryClient: QueryClient,
  from: string,
  to: string
): void {
  void queryClient.prefetchQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => fetchDashboard(from, to),
    staleTime: SHEET_STALE_MS,
  });
  void queryClient.prefetchQuery({
    queryKey: ["driver-incidents", from, to],
    queryFn: () => fetchDriverIncidents(from, to),
    staleTime: TELEMATICS_STALE_MS,
  });
  void queryClient.prefetchQuery({
    queryKey: ["speed-violations", from, to],
    queryFn: () => fetchSpeedViolations(from, to),
    staleTime: TELEMATICS_STALE_MS,
  });
  void queryClient.prefetchQuery({
    queryKey: ["unit-locations", from, to],
    queryFn: () => fetchUnitLocations(from, to),
    staleTime: TELEMATICS_STALE_MS,
  });
}

/** Dashboard KPIs, thefts, fleet, and utilization — one Google Sheets request. */
export function useDashboard(from: string, to: string) {
  return useQuery<DashboardBundle>({
    queryKey: ["dashboard", from, to],
    queryFn: () => fetchDashboard(from, to),
    staleTime: SHEET_STALE_MS,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
    refetchOnMount: false,
  });
}

/** Speeding violations — live telematics, loaded separately from the sheet dashboard. */
export function useSpeedViolations(from: string, to: string, enabled = true) {
  return useQuery<SpeedViolationsSummary>({
    queryKey: ["speed-violations", from, to],
    enabled,
    queryFn: () => fetchSpeedViolations(from, to),
    staleTime: TELEMATICS_STALE_MS,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  });
}

/** Current asset locations — live telematics overlay on the sheet fleet register. */
export function useUnitLocations(from: string, to: string, enabled = true) {
  return useQuery<UnitLatestRow[]>({
    queryKey: ["unit-locations", from, to],
    enabled,
    queryFn: () => fetchUnitLocations(from, to),
    staleTime: TELEMATICS_STALE_MS,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  });
}

export function useKpis(from: string, to: string) {
  const { data, ...rest } = useDashboard(from, to);
  return { data: data?.kpis, ...rest };
}

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
    queryKey: ["driver-incidents", from, to],
    queryFn: () => fetchDriverIncidents(from, to),
    staleTime: TELEMATICS_STALE_MS,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
    refetchOnMount: false,
  });
}

export function useReports(period: ReportSummary["period"]) {
  return useQuery<ReportSummary>({
    queryKey: ["reports", period],
    queryFn: async () => {
      const res = await fetch(`/api/reports?period=${period}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    staleTime: SHEET_STALE_MS,
  });
}

export function useFleet() {
  return useQuery<FleetSummary>({
    queryKey: ["fleet"],
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
    queryKey: ["unit-problems", unitId, from, to],
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
