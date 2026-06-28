"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { Sidebar, type NavView } from "@/components/layout/sidebar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  prefetchFleetQueries,
  useQueryClient,
} from "@/hooks/use-fleet-data";

const FleetDashboard = dynamic(
  () =>
    import("@/components/dashboard/fleet-dashboard").then((m) => ({
      default: m.FleetDashboard,
    })),
  { loading: () => <TabSkeleton /> }
);

const FuelTheftsTab = dynamic(
  () =>
    import("@/components/dashboard/fuel-thefts-tab").then((m) => ({
      default: m.FuelTheftsTab,
    })),
  { loading: () => <TabSkeleton /> }
);

const DriverIncidentsTab = dynamic(
  () =>
    import("@/components/dashboard/driver-incidents-tab").then((m) => ({
      default: m.DriverIncidentsTab,
    })),
  { loading: () => <TabSkeleton /> }
);

const UtilizationTab = dynamic(
  () =>
    import("@/components/dashboard/utilization-tab").then((m) => ({
      default: m.UtilizationTab,
    })),
  { loading: () => <TabSkeleton /> }
);

const ReportsTab = dynamic(
  () =>
    import("@/components/dashboard/reports-tab").then((m) => ({
      default: m.ReportsTab,
    })),
  { loading: () => <TabSkeleton /> }
);

function TabSkeleton() {
  return (
    <div className="space-y-4 p-6 md:p-8">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-slate-200/60"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-slate-200/50" />
    </div>
  );
}

const PAGE_TITLES: Record<NavView, string> = {
  dashboard: "Dashboard",
  utilization: "Utilization",
  "fuel-thefts": "Fuel Thefts",
  "driver-incidents": "Driver Incidents",
  reports: "Reports",
};

export function AppShell() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<NavView>("dashboard");
  const [from, setFrom] = useState(() => subDays(new Date(), 7).toISOString());
  const [to, setTo] = useState(() => new Date().toISOString());
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const debouncedFrom = useDebouncedValue(from, 350);
  const debouncedTo = useDebouncedValue(to, 350);

  const handleSidebarExpand = useCallback((expanded: boolean) => {
    setSidebarExpanded(expanded);
  }, []);

  const handlePrefetch = useCallback(
    (_target: NavView) => {
      prefetchFleetQueries(queryClient, debouncedFrom, debouncedTo);
    },
    [queryClient, debouncedFrom, debouncedTo]
  );

  useEffect(() => {
    prefetchFleetQueries(queryClient, debouncedFrom, debouncedTo);
  }, [queryClient, debouncedFrom, debouncedTo]);

  return (
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
        {view !== "dashboard" && (
          <header className="app-shell-header">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">
                  Fleet operations
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                  {PAGE_TITLES[view]}
                </h1>
                <p className="text-sm text-slate-500">
                  Security &amp; performance reporting for your fleet
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 p-2 shadow-sm">
                <input
                  type="date"
                  value={format(new Date(from), "yyyy-MM-dd")}
                  onChange={(e) =>
                    setFrom(new Date(e.target.value).toISOString())
                  }
                  className="dash-date-input h-9 rounded-lg px-3 text-sm"
                />
                <span className="text-sm text-slate-400">to</span>
                <input
                  type="date"
                  value={format(new Date(to), "yyyy-MM-dd")}
                  onChange={(e) =>
                    setTo(new Date(e.target.value + "T23:59:59").toISOString())
                  }
                  className="dash-date-input h-9 rounded-lg px-3 text-sm"
                />
              </div>
            </div>
          </header>
        )}

        {view === "dashboard" && (
          <div className="dash-toolbar sticky top-0 z-30 flex flex-wrap items-center justify-end gap-2 backdrop-blur-md">
            <input
              type="date"
              value={format(new Date(from), "yyyy-MM-dd")}
              onChange={(e) =>
                setFrom(new Date(e.target.value).toISOString())
              }
              className="dash-date-input h-9 rounded-lg px-3 text-sm"
            />
            <span className="text-sm text-slate-500">to</span>
            <input
              type="date"
              value={format(new Date(to), "yyyy-MM-dd")}
              onChange={(e) =>
                setTo(new Date(e.target.value + "T23:59:59").toISOString())
              }
              className="dash-date-input h-9 rounded-lg px-3 text-sm"
            />
          </div>
        )}

        <main
          className={
            view === "dashboard"
              ? "flex-1 overflow-auto"
              : "flex-1 overflow-auto p-6 md:p-8"
          }
        >
          {view === "dashboard" && (
            <FleetDashboard from={debouncedFrom} to={debouncedTo} />
          )}
          {view === "utilization" && (
            <UtilizationTab from={debouncedFrom} to={debouncedTo} />
          )}
          {view === "fuel-thefts" && (
            <FuelTheftsTab from={debouncedFrom} to={debouncedTo} />
          )}
          {view === "driver-incidents" && (
            <DriverIncidentsTab from={debouncedFrom} to={debouncedTo} />
          )}
          {view === "reports" && <ReportsTab />}
        </main>
      </div>
    </div>
  );
}
