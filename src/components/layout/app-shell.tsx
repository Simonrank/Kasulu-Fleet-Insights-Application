"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { cn, defaultViolationsFromIso } from "@/lib/utils";
import { FleetDashboard } from "@/components/dashboard/fleet-dashboard";
import { AnalysisWindowBar } from "@/components/layout/analysis-window-bar";
import { CategoryFilterBar } from "@/components/layout/category-filter-bar";
import { TheftTypeFilterBar } from "@/components/layout/theft-type-filter-bar";
import { UtilizationViewFilterBar } from "@/components/layout/utilization-view-filter-bar";
import { Sidebar, type NavView } from "@/components/layout/sidebar";
import { FleetCategoryFilterProvider } from "@/context/fleet-category-filter";
import { TheftFilterProvider } from "@/context/theft-filter";
import { UtilizationViewFilterProvider } from "@/context/utilization-view-filter";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  prefetchDriverIncidentsQuery,
  prefetchFleetQueries,
  useQueryClient,
  useSheetDateRange,
} from "@/hooks/use-fleet-data";
import { fetchLiveUnitLocations } from "@/lib/api/fleet-fetch";
import { fleetQueryKeys } from "@/lib/api/query-keys";

function TabSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-4 p-6 md:p-8">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-300" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-200"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
    </div>
  );
}

const CHUNK_RELOAD_KEY = "kasulu-chunk-reload";

/** Retry once after dev-server restarts invalidate old chunk URLs. */
function importTabWithRetry<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkError =
      message.includes("Loading chunk") || message.includes("ChunkLoadError");
    if (
      typeof window !== "undefined" &&
      isChunkError &&
      !sessionStorage.getItem(CHUNK_RELOAD_KEY)
    ) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    }
    throw error;
  });
}

type LazyTabProps = {
  from?: string;
  to?: string;
  isDefault24h?: boolean;
};

function lazyTab(
  importFn: () => Promise<{ default: ComponentType<LazyTabProps> }>,
  label: string
) {
  return dynamic(
    () => importTabWithRetry(importFn),
    { loading: () => <TabSkeleton label={label} />, ssr: false }
  );
}

const FuelTheftsTab = lazyTab(
  () =>
    import("@/components/dashboard/fuel-thefts-tab").then((m) => ({
      default: m.FuelTheftsTab as ComponentType<LazyTabProps>,
    })),
  "Loading fuel thefts…"
);

const DriverIncidentsTab = lazyTab(
  () =>
    import("@/components/dashboard/driver-incidents-tab").then((m) => ({
      default: m.DriverIncidentsTab as ComponentType<LazyTabProps>,
    })),
  "Loading driver incidents…"
);

const UtilizationTab = lazyTab(
  () =>
    import("@/components/dashboard/utilization-tab").then((m) => ({
      default: m.UtilizationTab as ComponentType<LazyTabProps>,
    })),
  "Loading utilization…"
);

const ReportsTab = lazyTab(
  () =>
    import("@/components/dashboard/reports-tab").then((m) => ({
      default: m.ReportsTab as ComponentType<LazyTabProps>,
    })),
  "Loading reports…"
);

function tabExtraFilters(view: NavView) {
  return (
    <>
      <CategoryFilterBar compact />
      {(view === "dashboard" || view === "fuel-thefts") && (
        <TheftTypeFilterBar />
      )}
      {view === "utilization" && <UtilizationViewFilterBar />}
    </>
  );
}

function TabPane({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(!active && "hidden")} aria-hidden={!active}>
      {children}
    </div>
  );
}

export function AppShell() {
  const queryClient = useQueryClient();
  const { data: sheetDateRange } = useSheetDateRange();
  const [view, setView] = useState<NavView>("dashboard");
  const [visitedTabs, setVisitedTabs] = useState<Set<NavView>>(
    () => new Set(["dashboard"])
  );
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [violationsUseCustomRange, setViolationsUseCustomRange] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!sheetDateRange || (from != null && to != null)) return;
    setFrom(sheetDateRange.defaultFrom);
    setTo(sheetDateRange.defaultTo);
  }, [sheetDateRange, from, to]);

  const debouncedFrom = useDebouncedValue(from ?? sheetDateRange?.defaultFrom ?? "", 350);
  const debouncedTo = useDebouncedValue(to ?? sheetDateRange?.defaultTo ?? "", 350);
  const rangeReady = Boolean(debouncedFrom && debouncedTo);

  const driverIncidentsFrom = useMemo(() => {
    if (!rangeReady) return "";
    if (violationsUseCustomRange) return debouncedFrom;
    return defaultViolationsFromIso(debouncedTo);
  }, [debouncedFrom, debouncedTo, violationsUseCustomRange, rangeReady]);

  const handleApplyRange = useCallback((nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setViolationsUseCustomRange(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      if (rangeReady) {
        prefetchFleetQueries(queryClient, debouncedFrom, debouncedTo);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [
    queryClient,
    rangeReady,
    debouncedFrom,
    debouncedTo,
    driverIncidentsFrom,
  ]);

  const handleSidebarExpand = useCallback((expanded: boolean) => {
    setSidebarExpanded(expanded);
  }, []);

  const handlePrefetch = useCallback(
    (target: NavView) => {
      prefetchFleetQueries(queryClient, debouncedFrom, debouncedTo);
      if (target === "driver-incidents" && driverIncidentsFrom && debouncedTo) {
        prefetchDriverIncidentsQuery(
          queryClient,
          driverIncidentsFrom,
          debouncedTo
        );
      }
    },
    [queryClient, debouncedFrom, debouncedTo, driverIncidentsFrom]
  );

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(view)) return prev;
      const next = new Set(prev);
      next.add(view);
      return next;
    });
  }, [view]);

  useEffect(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    void queryClient.prefetchQuery({
      queryKey: fleetQueryKeys.unitLocationsLive(),
      queryFn: fetchLiveUnitLocations,
      staleTime: 30_000,
    });
  }, [queryClient]);

  useEffect(() => {
    if (!rangeReady || view !== "driver-incidents") return;
    prefetchDriverIncidentsQuery(
      queryClient,
      driverIncidentsFrom,
      debouncedTo
    );
  }, [
    queryClient,
    rangeReady,
    view,
    driverIncidentsFrom,
    debouncedTo,
  ]);

  useEffect(() => {
    if (!rangeReady) return;
    prefetchFleetQueries(queryClient, debouncedFrom, debouncedTo);
  }, [queryClient, debouncedFrom, debouncedTo, rangeReady]);

  return (
    <FleetCategoryFilterProvider from={debouncedFrom} to={debouncedTo}>
      <TheftFilterProvider>
      <UtilizationViewFilterProvider>
      <div
        className={cn(
          "app-layout min-h-screen",
          sidebarExpanded && "app-layout--sidebar-expanded"
        )}
      >
      <Sidebar
        active={view}
        onNavigate={setView}
        onExpandChange={handleSidebarExpand}
        onPrefetch={handlePrefetch}
      />

      <div className="app-shell-main flex min-w-0 flex-col">
        <AnalysisWindowBar
          sheetDateRange={sheetDateRange}
          from={from ?? sheetDateRange?.defaultFrom ?? ""}
          to={to ?? sheetDateRange?.defaultTo ?? ""}
          onApply={handleApplyRange}
          onRefresh={() => void handleRefresh()}
          isRefreshing={isRefreshing}
          extraFilters={tabExtraFilters(view)}
        />

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden",
            view !== "dashboard" && view !== "fuel-thefts" && "p-6 md:p-8"
          )}
        >
          <TabPane active={view === "dashboard"}>
            {rangeReady ? (
              <FleetDashboard from={debouncedFrom} to={debouncedTo} />
            ) : (
              <TabSkeleton label="Loading dashboard…" />
            )}
          </TabPane>

          {visitedTabs.has("utilization") && (
            <TabPane active={view === "utilization"}>
              {rangeReady ? (
                <UtilizationTab from={debouncedFrom} to={debouncedTo} />
              ) : (
                <TabSkeleton label="Loading utilization…" />
              )}
            </TabPane>
          )}

          {visitedTabs.has("fuel-thefts") && (
            <TabPane active={view === "fuel-thefts"}>
              {rangeReady ? (
                <FuelTheftsTab from={debouncedFrom} to={debouncedTo} />
              ) : (
                <TabSkeleton label="Loading fuel thefts…" />
              )}
            </TabPane>
          )}

          {visitedTabs.has("driver-incidents") && (
            <TabPane active={view === "driver-incidents"}>
              {rangeReady ? (
                <DriverIncidentsTab
                  from={driverIncidentsFrom}
                  to={debouncedTo}
                  isDefault24h={!violationsUseCustomRange}
                />
              ) : (
                <TabSkeleton label="Loading driver incidents…" />
              )}
            </TabPane>
          )}

          {visitedTabs.has("reports") && (
            <TabPane active={view === "reports"}>
              {rangeReady ? (
                <ReportsTab from={debouncedFrom} to={debouncedTo} />
              ) : (
                <TabSkeleton label="Loading reports…" />
              )}
            </TabPane>
          )}
        </main>
      </div>
      </div>
      </UtilizationViewFilterProvider>
      </TheftFilterProvider>
    </FleetCategoryFilterProvider>
  );
}
