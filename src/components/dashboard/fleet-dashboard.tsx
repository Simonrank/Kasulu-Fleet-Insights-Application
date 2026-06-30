"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useDashboard, useLiveUnitLocations, useSpeedViolations } from "@/hooks/use-fleet-data";
import { emptySpeedViolationsSummary } from "@/lib/fleet/speed-violations-analytics";
import {
  connectivityBandLabel,
  connectivityStaleLabel,
  matchesConnectivityFilter,
} from "@/lib/fleet/connectivity";
import {
  applyLiveMobileStatusToBundle,
  buildLiveConnectivityState,
} from "@/lib/fleet/connectivity-overlay";
import {
  aggregateKpisForCategory,
  filterFleetTableByCategory,
  filterFleetUnitsByCategory,
} from "@/lib/fleet/category-kpis";
import { useFleetCategoryFilter } from "@/context/fleet-category-filter";
import { cn, formatNumber } from "@/lib/utils";
import { formatReportingPeriodLabel, isSameReportingDay } from "@/lib/google-sheets/reporting-date-range";
import type { ConnectivityFilter, FleetSummary, KpiSummary } from "@/lib/types";
import { filterTheftEvents } from "@/lib/fleet/theft-filters";
import {
  DataLoadError,
  VERCEL_SHEETS_HINTS,
} from "@/components/dashboard/data-load-error";
import { ConnectivityVehicleList } from "@/components/dashboard/connectivity-vehicle-list";
import { CurrentAssetLocationTable } from "@/components/dashboard/current-asset-location-table";
import { SpeedViolationsChart } from "@/components/dashboard/speed-violations-chart";
import { TopViolatorsTable } from "@/components/dashboard/top-violators-table";
import { VehicleDetailPanel } from "@/components/dashboard/vehicle-detail-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  FleetIntelligenceRoot,
  useFleetIntelligenceFilters,
} from "@/components/dashboard/fleet-register-panel";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Executive palette — teal trust, refined rose/amber alerts */
const CHART = {
  direct: "#e11d48",
  returnPipe: "#d97706",
  updating: "#059669",
  nonUpdating: "#dc2626",
  grid: "#e2e8f0",
  axis: "#64748b",
  tooltipBg: "#ffffff",
};

type Props = {
  from: string;
  to: string;
};

function DashboardSkeleton({ liveConnectivity }: { liveConnectivity?: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="dash-metrics-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-[8.75rem] animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm"
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-3" />
        <div className="min-w-0 lg:col-span-2">
          {liveConnectivity ?? (
            <div className="h-80 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm" />
          )}
        </div>
      </div>

      <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm" />
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm" />
    </div>
  );
}

const CONNECTIVITY_CHART = {
  updating: "#059669",
  staleOver4Hours: "#eab308",
  staleOver24Hours: "#f97316",
  staleOver48Hours: "#dc2626",
  unknown: "#94a3b8",
};

function ConnectivityPanel({
  data,
  fleet,
  filter,
  onFilterChange,
  isLive = false,
}: {
  data: Pick<
    KpiSummary,
    "connectivityBands" | "updatingUnits" | "nonUpdatingUnits" | "totalUnits"
  >;
  fleet: FleetSummary | undefined;
  filter: ConnectivityFilter | null;
  onFilterChange: (filter: ConnectivityFilter | null) => void;
  isLive?: boolean;
}) {
  const bands = data.connectivityBands;
  const toggleFilter = (next: ConnectivityFilter) => {
    onFilterChange(filter === next ? null : next);
  };

  const rows: {
    key: ConnectivityFilter;
    label: string;
    value: number;
    fill: string;
    hint: string;
  }[] = [
    {
      key: "updating",
      label: connectivityBandLabel("updating"),
      value: bands.updating,
      fill: CONNECTIVITY_CHART.updating,
      hint: "≤ 4 hours",
    },
    {
      key: "stale_over_4h",
      label: connectivityStaleLabel("stale_over_4h"),
      value: bands.staleOver4Hours,
      fill: CONNECTIVITY_CHART.staleOver4Hours,
      hint: "4–24 hours ago",
    },
    {
      key: "stale_over_24h",
      label: connectivityStaleLabel("stale_over_24h"),
      value: bands.staleOver24Hours,
      fill: CONNECTIVITY_CHART.staleOver24Hours,
      hint: "24–48 hours ago",
    },
    {
      key: "stale_over_48h",
      label: connectivityStaleLabel("stale_over_48h"),
      value: bands.staleOver48Hours,
      fill: CONNECTIVITY_CHART.staleOver48Hours,
      hint: "More than 48 hours ago",
    },
  ];

  if (bands.unknown > 0) {
    rows.push({
      key: "unknown",
      label: connectivityBandLabel("unknown"),
      value: bands.unknown,
      fill: CONNECTIVITY_CHART.unknown,
      hint: "No timestamp",
    });
  }

  const slices = rows
    .filter((row) => row.value > 0)
    .map((row) => ({ name: row.label, value: row.value, fill: row.fill }));

  const onlinePct =
    data.totalUnits > 0 ? (data.updatingUnits / data.totalUnits) * 100 : 0;

  return (
    <div className="dash-panel flex h-full min-w-0 flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-dash-foreground">
            Fleet connectivity
          </h3>
          <p className="mt-0.5 text-xs text-dash-muted">
            {isLive
              ? "Live telematics · each unit in one band"
              : "Last message · each unit in one band"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
          <span className="rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#0d9488]">
            {data.totalUnits} units
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="relative mx-auto h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={
                  slices.length
                    ? slices
                    : [{ name: "Empty", value: 1, fill: "#e2e8f0" }]
                }
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={54}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-dash-foreground tabular-nums">
              {formatNumber(onlinePct, 0)}%
            </span>
            <span className="text-[9px] uppercase tracking-wider text-dash-muted">
              updating
            </span>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2">
          {rows.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => toggleFilter(row.key)}
              title={`${row.label} — ${row.hint}`}
              className={cn(
                "flex min-w-0 items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
                row.key === "updating"
                  ? "border-slate-200 bg-slate-50 hover:border-[#99f6e4] hover:bg-[#f0fdfa]"
                  : "border-slate-200 bg-slate-50 hover:border-red-200 hover:bg-red-50/50",
                filter === row.key &&
                  (row.key === "updating"
                    ? "border-[#99f6e4] bg-[#f0fdfa] ring-1 ring-[#0d9488]/20"
                    : "border-red-200 bg-red-50/80 ring-1 ring-red-200")
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.fill }}
                />
                <span className="truncate text-[11px] leading-tight text-dash-foreground">
                  {row.label}
                </span>
              </div>
              <span
                className="shrink-0 text-sm font-bold tabular-nums"
                style={{ color: row.fill }}
              >
                {row.value}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filter && fleet && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <ConnectivityVehicleList
            units={fleet.units}
            filter={filter}
            compact
          />
        </div>
      )}
    </div>
  );
}

function DashboardContent({ from, to }: Props) {
  const [connectivityFilter, setConnectivityFilter] =
    useState<ConnectivityFilter | null>(null);

  const {
    theftType,
    vehicleType,
    unitCategoryById,
    selectedUnitId,
    selectedUnit,
  } = useFleetIntelligenceFilters();
  const { categoryFilter: kpiCategoryFilter, unitCategoryById: kpiUnitCategoryById } =
    useFleetCategoryFilter();

  const {
    data: liveUnitLocations,
    isLoading: liveLocationsLoading,
    isFetching: liveLocationsFetching,
    error: liveLocationsError,
  } = useLiveUnitLocations();
  const liveRows = liveUnitLocations ?? [];

  const { data: dashboard, isLoading, isFetching } = useDashboard(from, to);
  const {
    data: speedViolationsAsync,
    isLoading: speedViolationsLoading,
    isFetching: speedViolationsFetching,
    error: speedViolationsError,
  } = useSpeedViolations(from, to);
  const speedViolations = speedViolationsAsync ?? emptySpeedViolationsSummary();
  const speedChartLoading =
    speedViolationsLoading ||
    (speedViolationsFetching && speedViolations.totalEvents === 0);

  const liveConnectivity = useMemo(
    () =>
      buildLiveConnectivityState(
        liveRows,
        dashboard?.kpis.totalUnits
      ),
    [liveRows, dashboard?.kpis.totalUnits]
  );

  const bundle = useMemo(() => {
    if (!dashboard) return undefined;
    return applyLiveMobileStatusToBundle(dashboard, liveRows);
  }, [dashboard, liveRows]);

  const connectivityKpis = bundle?.kpis ?? liveConnectivity.kpis;
  const connectivityFleet = bundle?.fleet ?? liveConnectivity.fleet;

  const kpis = bundle?.kpis;
  const thefts = bundle?.thefts;
  const fleet = bundle?.fleet;

  const filteredEvents = useMemo(() => {
    if (!thefts) return [];
    return filterTheftEvents(thefts.events, {
      search: "",
      theftType,
      durationBand: "all",
      vehicleType,
      unitCategoryById,
      unitId: selectedUnitId,
    });
  }, [
    thefts,
    theftType,
    vehicleType,
    unitCategoryById,
    selectedUnitId,
  ]);

  const kpiTheftEvents = useMemo(() => {
    if (!thefts) return [];
    if (kpiCategoryFilter === "all") return thefts.events;
    return filterTheftEvents(thefts.events, {
      search: "",
      theftType: "all",
      durationBand: "all",
      vehicleType: kpiCategoryFilter,
      unitCategoryById: kpiUnitCategoryById,
    });
  }, [thefts, kpiCategoryFilter, kpiUnitCategoryById]);

  const kpiMetrics = useMemo(() => {
    if (!kpis || !thefts || kpiCategoryFilter === "all") return kpis;
    const rows = filterFleetTableByCategory(
      thefts.fleetTable,
      kpiCategoryFilter,
      kpiUnitCategoryById
    );
    const units = filterFleetUnitsByCategory(
      fleet?.units ?? [],
      kpiCategoryFilter
    );
    return aggregateKpisForCategory(kpis, rows, units, kpiTheftEvents);
  }, [
    kpis,
    thefts,
    fleet,
    kpiCategoryFilter,
    kpiUnitCategoryById,
    kpiTheftEvents,
  ]);

  const selectedUnitMetrics = useMemo(() => {
    if (!thefts || !selectedUnitId) return undefined;
    return thefts.fleetTable.find((r) => r.unitId === selectedUnitId);
  }, [thefts, selectedUnitId]);

  const kpiTheftStats = useMemo(() => {
    if (!kpiMetrics) return { volume: 0, count: 0 };
    if (theftType === "direct") {
      return {
        volume: kpiMetrics.directThefts.volumeLiters,
        count: kpiMetrics.directThefts.count,
      };
    }
    if (theftType === "return_pipe") {
      return {
        volume: kpiMetrics.returnPipeThefts.volumeLiters,
        count: kpiMetrics.returnPipeThefts.count,
      };
    }
    return {
      volume:
        kpiMetrics.directThefts.volumeLiters +
        kpiMetrics.returnPipeThefts.volumeLiters,
      count: kpiMetrics.directThefts.count + kpiMetrics.returnPipeThefts.count,
    };
  }, [kpiMetrics, theftType]);

  const totalTheftLiters = kpiTheftStats.volume;
  const theftEvents = kpiTheftStats.count;

  const fleetCountDisplay = kpiMetrics?.totalUnits ?? 0;

  const barData = useMemo(() => {
    if (!thefts) return [];

    return [...thefts.fleetTable]
      .filter((r) => {
        if (selectedUnitId && r.unitId !== selectedUnitId) return false;
        if (theftType === "direct") return r.directTheftLiters > 0;
        if (theftType === "return_pipe") return r.returnPipeTheftLiters > 0;
        return r.totalTheftLiters > 0;
      })
      .sort((a, b) => {
        if (theftType === "direct")
          return b.directTheftLiters - a.directTheftLiters;
        if (theftType === "return_pipe")
          return b.returnPipeTheftLiters - a.returnPipeTheftLiters;
        return b.totalTheftLiters - a.totalTheftLiters;
      })
      .slice(0, 8)
      .map((r) => ({
        name: r.reg.length > 12 ? r.reg.slice(0, 12) + "…" : r.reg,
        fullName: r.reg,
        direct: Math.round(r.directTheftLiters),
        returnPipe: Math.round(r.returnPipeTheftLiters),
        total:
          theftType === "direct"
            ? Math.round(r.directTheftLiters)
            : theftType === "return_pipe"
              ? Math.round(r.returnPipeTheftLiters)
              : Math.round(r.totalTheftLiters),
      }));
  }, [thefts, theftType, selectedUnitId]);

  const sheetPending = !kpiMetrics || !thefts || !kpis;

  const connectivityPanel = (
    <ConnectivityPanel
      data={connectivityKpis}
      fleet={connectivityFleet}
      filter={connectivityFilter}
      onFilterChange={setConnectivityFilter}
      isLive
    />
  );

  if (sheetPending) {
    return (
      <div className="dashboard-workspace min-h-full">
        <div className="relative space-y-8 p-6 md:p-8">
          <p
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            aria-live="polite"
          >
            Loading fleet metrics from Google Sheets… live connectivity may appear
            first.
          </p>
          <DashboardSkeleton
            liveConnectivity={liveRows.length > 0 ? connectivityPanel : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-workspace min-h-full">
      <div className="dashboard-workspace__glow pointer-events-none" aria-hidden />

      <div className="relative space-y-8 p-6 md:p-8">
        {(isFetching || isLoading) && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" aria-live="polite">
            Updating period… fuel and theft totals reflect the selected analysis window.
          </p>
        )}

        <p className="text-sm text-slate-600">
          Reporting period:{" "}
          <span className="font-medium text-slate-800">
            {formatReportingPeriodLabel(from, to)}
          </span>
          {" · "}
          {isSameReportingDay(from, to)
            ? `${theftEvents} theft event${theftEvents === 1 ? "" : "s"} on this day`
            : `${theftEvents} theft event${theftEvents === 1 ? "" : "s"} summed across days`}
          {" · "}
          {formatNumber(totalTheftLiters, 1)} L total stolen
        </p>

        {selectedUnit && (
          <VehicleDetailPanel
            unit={selectedUnit}
            metrics={selectedUnitMetrics}
            events={filteredEvents}
            from={from}
            to={to}
          />
        )}

        <div className="dash-metrics-grid">
          <MetricCard
            title={kpiCategoryFilter !== "all" ? kpiCategoryFilter : "All fleet"}
            value={`${fleetCountDisplay}`}
            detail={
              kpiCategoryFilter !== "all"
                ? `Units in ${kpiCategoryFilter} category`
                : "Registered units"
            }
            tone="accent"
          />
          <MetricCard
            title="Engine hours"
            value={`${formatNumber(kpiMetrics.totalEngineHours, 0)} hrs`}
            detail={`${formatNumber(kpiMetrics.updatingUnits, 0)} units updating now`}
            tone="accent"
          />
          <MetricCard
            title="Consumption (Ltrs/Hr)"
            value={`${formatNumber(kpiMetrics.consumptionLitersPerHour, 2)} L/hr`}
            detail="Fleet average burn rate"
            tone="accent"
          />
          <MetricCard
            title="Distance covered"
            value={`${formatNumber(kpiMetrics.totalDistanceKm, 0)} km`}
            detail="Aggregate fleet mileage"
            tone="neutral"
          />
          <MetricCard
            title="Total fuel consumed"
            value={`${formatNumber(kpiMetrics.totalFuelConsumedLiters, 0)} L`}
            detail="Aggregate litres used in period"
            tone="accent"
          />
          <MetricCard
            title="Total fuel stolen"
            value={`${formatNumber(totalTheftLiters, 1)} L`}
            detail={`${theftEvents} ${theftType === "all" ? "recorded" : theftType === "direct" ? "direct" : "return pipe"} events in period`}
            tone="danger"
          />
          <MetricCard
            title="Consumption rate"
            value={`${formatNumber(kpiMetrics.consumptionKmPerLiter, 2)} km/L`}
            detail="Fleet average fuel efficiency"
            tone="accent"
          />
          <MetricCard
            title="Direct theft"
            value={`${formatNumber(kpiMetrics.directThefts.volumeLiters, 1)} L`}
            detail={`${kpiMetrics.directThefts.count} direct drain events`}
            tone="danger"
          />
          <MetricCard
            title="Return pipe theft"
            value={`${formatNumber(kpiMetrics.returnPipeThefts.volumeLiters, 0)} L`}
            detail={`${kpiMetrics.returnPipeThefts.count} return-line events`}
            tone="warning"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="dash-panel lg:col-span-3">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-dash-foreground">
                  Top units by stolen litres
                </h3>
                <p className="mt-1 text-xs text-dash-muted">
                  {theftType === "all"
                    ? "Direct vs return pipe · ranked by volume"
                    : theftType === "direct"
                      ? "Direct theft only · ranked by litres stolen"
                      : "Return pipe only · ranked by litres stolen"}
                </p>
              </div>
              {theftType === "all" && (
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#e11d48]" />
                  Direct theft
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#d97706]" />
                  Return pipe
                </span>
              </div>
              )}
            </div>

            {barData.length === 0 ? (
              <p className="py-16 text-center text-sm text-dash-muted">
                {theftType === "all"
                  ? "No theft recorded in this period"
                  : `No ${theftType === "direct" ? "direct" : "return pipe"} theft incidents in this period`}
              </p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: CHART.tooltipBg,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        color: "#0f172a",
                        boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                      }}
                      formatter={(value, name) => [
                        `${value} L`,
                        name === "direct"
                          ? "Direct"
                          : name === "returnPipe"
                            ? "Return pipe"
                            : "Stolen",
                      ]}
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { fullName?: string })
                          ?.fullName ?? ""
                      }
                    />
                    <Legend wrapperStyle={{ display: "none" }} />
                    {theftType === "all" ? (
                      <>
                        <Bar
                          dataKey="direct"
                          stackId="theft"
                          fill={CHART.direct}
                          radius={[0, 0, 0, 0]}
                          barSize={14}
                        />
                        <Bar
                          dataKey="returnPipe"
                          stackId="theft"
                          fill={CHART.returnPipe}
                          radius={[0, 6, 6, 0]}
                          barSize={14}
                        />
                      </>
                    ) : (
                      <Bar
                        dataKey="total"
                        fill={
                          theftType === "direct" ? CHART.direct : CHART.returnPipe
                        }
                        radius={[0, 6, 6, 0]}
                        barSize={14}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="min-w-0 lg:col-span-2">
            <ConnectivityPanel
              data={connectivityKpis}
              fleet={connectivityFleet}
              filter={connectivityFilter}
              onFilterChange={setConnectivityFilter}
              isLive
            />
          </div>
        </div>

        <SpeedViolationsChart
          data={speedViolations}
          isLoading={speedChartLoading}
          isFetching={speedViolationsFetching}
          error={
            speedViolationsError instanceof Error
              ? speedViolationsError.message
              : null
          }
        />

        <div className="space-y-6">
          <TopViolatorsTable violators={thefts.topViolators} />
          <CurrentAssetLocationTable
            rows={liveRows}
            isLoading={
              liveLocationsLoading ||
              (liveLocationsFetching && liveRows.length === 0)
            }
            error={
              liveLocationsError instanceof Error
                ? liveLocationsError.message
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}

export function FleetDashboard({ from, to }: Props) {
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDashboard(from, to);

  if (isLoading && !dashboard) {
    return (
      <FleetIntelligenceRoot from={from} to={to} fleet={undefined}>
        <DashboardContent from={from} to={to} />
      </FleetIntelligenceRoot>
    );
  }

  if (isError || !dashboard?.fleet) {
    const message =
      error instanceof Error
        ? error.message
        : "Fleet data did not load. Check your Google Sheets connection.";

    return (
      <div className="flex min-h-[50vh] items-start justify-center p-6 md:p-8">
        <DataLoadError
          title="Dashboard could not load"
          message={message}
          hints={VERCEL_SHEETS_HINTS}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  return (
    <FleetIntelligenceRoot from={from} to={to} fleet={dashboard.fleet}>
      <DashboardContent from={from} to={to} />
    </FleetIntelligenceRoot>
  );
}

export function DateRangeLabel({ from, to }: { from: string; to: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Period: {format(new Date(from), "dd MMM yyyy")} —{" "}
      {format(new Date(to), "dd MMM yyyy")}
    </p>
  );
}
