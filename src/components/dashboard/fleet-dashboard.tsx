"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import {
  Radio,
} from "lucide-react";
import { useDashboard, useSpeedViolations, useUnitLocations } from "@/hooks/use-fleet-data";
import { emptySpeedViolationsSummary } from "@/lib/fleet/speed-violations-analytics";
import { cn, formatNumber } from "@/lib/utils";
import type {
  ConnectivityFilter,
  FleetSummary,
  KpiSummary,
} from "@/lib/types";
import { filterTheftEvents } from "@/lib/fleet/theft-filters";
import { ConnectivityVehicleList } from "@/components/dashboard/connectivity-vehicle-list";
import { CurrentAssetLocationTable } from "@/components/dashboard/current-asset-location-table";
import { SpeedViolationsChart } from "@/components/dashboard/speed-violations-chart";
import { TopViolatorsTable } from "@/components/dashboard/top-violators-table";
import { VehicleDetailPanel } from "@/components/dashboard/vehicle-detail-panel";
import {
  FleetIntelligenceRoot,
  FleetIntelligenceWorkspace,
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

function MetricCard({
  title,
  value,
  detail,
  tone = "neutral",
}: {
  title: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "accent" | "danger" | "warning";
}) {
  return (
    <div
      className={cn(
        "dash-metric-card",
        tone === "danger" && "dash-metric-card--danger",
        tone === "accent" && "dash-metric-card--accent",
        tone === "warning" && "dash-metric-card--warning",
        tone === "neutral" && "dash-metric-card--neutral"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dash-muted">
        {title}
      </p>
      <p className="dash-metric-card__value">{value}</p>
      {detail && (
        <p className="mt-2 text-[11px] leading-snug text-dash-muted">{detail}</p>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-slate-200/60" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[8.75rem] animate-pulse rounded-2xl bg-white shadow-sm" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-80 animate-pulse rounded-2xl bg-white shadow-sm lg:col-span-3" />
        <div className="h-80 animate-pulse rounded-2xl bg-white shadow-sm lg:col-span-2" />
      </div>
    </div>
  );
}

function ConnectivityPanel({
  data,
  fleet,
  filter,
  onFilterChange,
}: {
  data: KpiSummary;
  fleet: FleetSummary | undefined;
  filter: ConnectivityFilter | null;
  onFilterChange: (filter: ConnectivityFilter | null) => void;
}) {
  const toggleFilter = (next: ConnectivityFilter) => {
    onFilterChange(filter === next ? null : next);
  };

  const slices = [
    { name: "Updating", value: data.updatingUnits, fill: CHART.updating },
    { name: "Non-updating", value: data.nonUpdatingUnits, fill: CHART.nonUpdating },
  ].filter((s) => s.value > 0);

  const onlinePct =
    data.totalUnits > 0
      ? (data.updatingUnits / data.totalUnits) * 100
      : 0;

  return (
    <div className="dash-panel h-full">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-dash-foreground">
          Fleet connectivity
        </h3>
        <p className="mt-1 text-xs text-dash-muted">
          Live telemetry · last 30 minutes
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices.length ? slices : [{ name: "Empty", value: 1, fill: "#e2e8f0" }]}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={4}
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
            <span className="text-2xl font-bold text-dash-foreground tabular-nums">
              {formatNumber(onlinePct, 0)}%
            </span>
            <span className="text-[10px] uppercase tracking-wider text-dash-muted">
              online
            </span>
          </div>
        </div>

        <div className="grid w-full flex-1 gap-3">
          <button
            type="button"
            onClick={() => toggleFilter("updating")}
            className={cn(
              "dash-stat-row w-full cursor-pointer text-left transition-colors hover:border-[#99f6e4] hover:bg-[#f0fdfa]",
              filter === "updating" && "border-[#99f6e4] bg-[#f0fdfa] ring-1 ring-[#0d9488]/20"
            )}
          >
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#059669]" />
              <span className="text-sm text-dash-foreground">Updating</span>
            </div>
            <span className="text-lg font-bold tabular-nums text-[#059669]">
              {data.updatingUnits}
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleFilter("non_updating")}
            className={cn(
              "dash-stat-row w-full cursor-pointer text-left transition-colors hover:border-red-200 hover:bg-red-50/50",
              filter === "non_updating" &&
                "border-red-200 bg-red-50/80 ring-1 ring-red-200"
            )}
          >
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#dc2626]" />
              <span className="text-sm text-dash-foreground">Non-updating</span>
            </div>
            <span className="text-lg font-bold tabular-nums text-[#dc2626]">
              {data.nonUpdatingUnits}
            </span>
          </button>
          <div className="dash-stat-row border-[#99f6e4] bg-[#f0fdfa]">
            <span className="text-sm text-dash-muted">Total fleet</span>
            <span className="font-semibold tabular-nums text-[#0d9488]">
              {data.totalUnits} units
            </span>
          </div>
        </div>
      </div>

      {filter && fleet && (
        <div className="mt-6 border-t border-border/60 pt-5">
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
    durationBand,
    vehicleType,
    unitCategoryById,
    selectedUnitId,
    selectedUnit,
  } = useFleetIntelligenceFilters();

  const { data: dashboard, isLoading, isFetching } = useDashboard(from, to);
  const {
    data: speedViolationsAsync,
    isLoading: speedViolationsLoading,
    isFetching: speedViolationsFetching,
    error: speedViolationsError,
  } = useSpeedViolations(from, to);
  const {
    data: unitLocations,
    isLoading: unitLocationsLoading,
    isFetching: unitLocationsFetching,
    error: unitLocationsError,
  } = useUnitLocations(from, to);
  const speedViolations = speedViolationsAsync ?? emptySpeedViolationsSummary();
  const speedChartLoading =
    speedViolationsLoading ||
    (speedViolationsFetching && speedViolations.totalEvents === 0);
  const kpis = dashboard?.kpis;
  const thefts = dashboard?.thefts;
  const fleet = dashboard?.fleet;

  const filteredEvents = useMemo(() => {
    if (!thefts) return [];
    return filterTheftEvents(thefts.events, {
      search: "",
      theftType,
      durationBand,
      vehicleType,
      unitCategoryById,
      unitId: selectedUnitId,
    });
  }, [
    thefts,
    theftType,
    durationBand,
    vehicleType,
    unitCategoryById,
    selectedUnitId,
  ]);

  const selectedUnitMetrics = useMemo(() => {
    if (!thefts || !selectedUnitId) return undefined;
    return thefts.fleetTable.find((r) => r.unitId === selectedUnitId);
  }, [thefts, selectedUnitId]);

  const theftStats = useMemo(() => {
    if (!kpis) return { volume: 0, count: 0 };
    if (theftType === "direct") {
      return {
        volume: kpis.directThefts.volumeLiters,
        count: kpis.directThefts.count,
      };
    }
    if (theftType === "return_pipe") {
      return {
        volume: kpis.returnPipeThefts.volumeLiters,
        count: kpis.returnPipeThefts.count,
      };
    }
    return {
      volume:
        kpis.directThefts.volumeLiters + kpis.returnPipeThefts.volumeLiters,
      count: kpis.directThefts.count + kpis.returnPipeThefts.count,
    };
  }, [kpis, theftType]);

  const totalTheftLiters = theftStats.volume;
  const theftEvents = theftStats.count;

  const barData = useMemo(() => {
    if (!thefts) return [];

    return [...thefts.fleetTable]
      .filter((r) => {
        if (selectedUnitId && r.unitId !== selectedUnitId) return false;
        if (vehicleType !== "all") {
          const unit = fleet?.units.find((u) => u.id === r.unitId);
          if (unit?.categoryKey !== vehicleType) return false;
        }
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
  }, [thefts, theftType, vehicleType, fleet, selectedUnitId]);

  if (isLoading && !kpis) {
    return <DashboardSkeleton />;
  }

  if (!kpis || !thefts) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-workspace min-h-full">
      <div className="dashboard-workspace__glow pointer-events-none" aria-hidden />

      <div className="relative space-y-8 p-6 md:p-8">
        {isFetching && (
          <p className="text-xs text-[#0d9488]/80" aria-live="polite">
            Refreshing live sheet data…
          </p>
        )}

        <FleetIntelligenceWorkspace />

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
            title="All fleet"
            value={`${fleet?.summary.total ?? kpis.totalUnits}`}
            detail="Registered units"
            tone="accent"
          />
          <MetricCard
            title="Engine hours"
            value={`${formatNumber(kpis.totalEngineHours, 0)} hrs`}
            detail={`${formatNumber(kpis.updatingUnits, 0)} units updating now`}
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
            value={`${formatNumber(kpis.consumptionKmPerLiter, 2)} km/L`}
            detail="Fleet average fuel efficiency"
            tone="accent"
          />
          <MetricCard
            title="Consumption (Ltrs/Hr)"
            value={`${formatNumber(kpis.consumptionLitersPerHour, 2)} L/hr`}
            detail={`${formatNumber(kpis.totalEngineHours, 0)} engine hours in period`}
            tone="accent"
          />
          <MetricCard
            title="Distance covered"
            value={`${formatNumber(kpis.totalDistanceKm, 0)} km`}
            detail="Aggregate fleet mileage"
            tone="neutral"
          />
          <MetricCard
            title="Direct theft"
            value={`${formatNumber(kpis.directThefts.volumeLiters, 0)} L`}
            detail={`${kpis.directThefts.count} direct drain events`}
            tone="danger"
          />
          <MetricCard
            title="Return pipe theft"
            value={`${formatNumber(kpis.returnPipeThefts.volumeLiters, 0)} L`}
            detail={`${kpis.returnPipeThefts.count} return-line events`}
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

          <div className="lg:col-span-2">
            <ConnectivityPanel
              data={kpis}
              fleet={fleet}
              filter={connectivityFilter}
              onFilterChange={setConnectivityFilter}
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
            rows={unitLocations ?? []}
            isLoading={
              unitLocationsLoading ||
              (unitLocationsFetching && (unitLocations?.length ?? 0) === 0)
            }
            error={
              unitLocationsError instanceof Error
                ? unitLocationsError.message
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}

export function FleetDashboard({ from, to }: Props) {
  const { data: dashboard, isLoading } = useDashboard(from, to);
  const fleet = dashboard?.fleet;

  if (isLoading && !dashboard) {
    return <DashboardSkeleton />;
  }

  return (
    <FleetIntelligenceRoot from={from} to={to} fleet={fleet}>
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
