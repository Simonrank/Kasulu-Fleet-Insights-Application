"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  DashboardBundle,
  FleetDataSource,
  KpiSummary,
  FuelTheftsResponse,
  DriverIncidentRow,
  ReportSummary,
  UtilizationSummary,
  FleetSummary,
  UnitProblemsResponse,
  TheftFilter,
} from "@/lib/types";

function buildQuery(from: string, to: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ from, to, ...extra });
  return params.toString();
}

/** Single round-trip: KPIs, thefts, fleet — from Google Sheets or Wialon API. */
export function useDashboard(
  from: string,
  to: string,
  source: FleetDataSource = "google_sheets"
) {
  return useQuery<DashboardBundle>({
    queryKey: ["dashboard", from, to, source],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard?${buildQuery(from, to, { source })}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load dashboard");
      }
      return res.json();
    },
    staleTime: 90_000,
    placeholderData: (prev) => prev,
  });
}

export function useKpis(
  from: string,
  to: string,
  source: FleetDataSource = "google_sheets"
) {
  const { data, ...rest } = useDashboard(from, to, source);
  return { data: data?.kpis, ...rest };
}

export function useFuelThefts(
  from: string,
  to: string,
  _type: TheftFilter,
  source: FleetDataSource = "google_sheets"
) {
  const { data, ...rest } = useDashboard(from, to, source);
  return { data: data?.thefts, ...rest };
}

export function useDriverIncidents(from: string, to: string) {
  return useQuery<DriverIncidentRow[]>({
    queryKey: ["driver-incidents", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/driver-incidents?${buildQuery(from, to)}`);
      if (!res.ok) throw new Error("Failed to load incidents");
      return res.json();
    },
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
  });
}

export function useUtilization(from: string, to: string) {
  return useQuery<UtilizationSummary>({
    queryKey: ["utilization", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/utilization?${buildQuery(from, to)}`);
      if (!res.ok) throw new Error("Failed to load utilization");
      return res.json();
    },
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
      const res = await fetch(
        `/api/fleet/${unitId}/problems?${buildQuery(from, to)}`
      );
      if (!res.ok) throw new Error("Failed to load unit problems");
      return res.json();
    },
  });
}
