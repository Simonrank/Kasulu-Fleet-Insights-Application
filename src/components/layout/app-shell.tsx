"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { FleetDataSource } from "@/lib/types";
import { format, subDays } from "date-fns";
import { Sidebar, type NavView } from "@/components/layout/sidebar";
import { DataSourceToggle } from "@/components/layout/data-source-toggle";
import { FleetDashboard } from "@/components/dashboard/fleet-dashboard";
import { FuelTheftsTab } from "@/components/dashboard/fuel-thefts-tab";
import { DriverIncidentsTab } from "@/components/dashboard/driver-incidents-tab";
import { UtilizationTab } from "@/components/dashboard/utilization-tab";
import { ReportsTab } from "@/components/dashboard/reports-tab";

const PAGE_TITLES: Record<NavView, string> = {
  dashboard: "Dashboard",
  utilization: "Utilization",
  "fuel-thefts": "Fuel Thefts",
  "driver-incidents": "Driver Incidents",
  reports: "Reports",
};

export function AppShell() {
  const [view, setView] = useState<NavView>("dashboard");
  const [from, setFrom] = useState(() => subDays(new Date(), 7).toISOString());
  const [to, setTo] = useState(() => new Date().toISOString());
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dataSource, setDataSource] = useState<FleetDataSource>("google_sheets");
  const dualSourceEnabled =
    process.env.NEXT_PUBLIC_DUAL_SOURCE === "true";
  const handleSidebarExpand = useCallback((expanded: boolean) => {
    setSidebarExpanded(expanded);
  }, []);

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
                {dualSourceEnabled && (
                  <DataSourceToggle value={dataSource} onChange={setDataSource} />
                )}
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
            {dualSourceEnabled && (
              <DataSourceToggle value={dataSource} onChange={setDataSource} />
            )}
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
            <FleetDashboard from={from} to={to} dataSource={dataSource} />
          )}
          {view === "utilization" && (
            <UtilizationTab from={from} to={to} />
          )}
          {view === "fuel-thefts" && (
            <FuelTheftsTab from={from} to={to} dataSource={dataSource} />
          )}
          {view === "driver-incidents" && (
            <DriverIncidentsTab from={from} to={to} />
          )}
          {view === "reports" && <ReportsTab />}
        </main>
      </div>
    </div>
  );
}
