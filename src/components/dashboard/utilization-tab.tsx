"use client";

import { useMemo } from "react";
import { useUtilization } from "@/hooks/use-fleet-data";
import { useFleetCategoryFilter } from "@/context/fleet-category-filter";
import { useUtilizationViewFilter } from "@/context/utilization-view-filter";
import { aggregateUtilizationFleet } from "@/lib/fleet/fleet-metrics-aggregation";
import { matchesCategoryFilter } from "@/lib/fleet/theft-filters";
import { buildNaturalBuckets } from "@/lib/data-driven/buckets";
import {
  DataLoadError,
  VERCEL_SHEETS_HINTS,
} from "@/components/dashboard/data-load-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UtilizationPerUnitTable } from "@/components/dashboard/utilization-per-unit-table";
import { cn, formatNumber } from "@/lib/utils";
import { Gauge, MapPin, Clock, Timer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  from: string;
  to: string;
};

const CHART = {
  distance: "#38bdf8",
  engine: "#a78bfa",
  bucket: "#f472b6",
  grid: "#e2e8f0",
  axis: "#64748b",
};

export function UtilizationTab({ from, to }: Props) {
  const { view } = useUtilizationViewFilter();
  const { categoryFilter, unitCategoryById, isActive: categoryFilterActive } =
    useFleetCategoryFilter();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    isPlaceholderData,
  } = useUtilization(from, to);

  const categoryScopedUnits = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === "all") return data.byUnit;
    return data.byUnit.filter((unit) =>
      matchesCategoryFilter(
        unitCategoryById.get(unit.unitId) ?? unit.category,
        categoryFilter
      )
    );
  }, [data, categoryFilter, unitCategoryById]);

  const filteredUnits = useMemo(() => {
    if (!data) return [];

    let units = [...categoryScopedUnits];
    if (view === "underutilized") {
      units.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (view === "top") {
      units.sort((a, b) => b.distanceKm - a.distanceKm);
    }

    return units;
  }, [data, view, categoryScopedUnits]);

  const topChartData = useMemo(() => {
    if (!data) return [];
    return [...categoryScopedUnits]
      .sort((a, b) => b.distanceKm - a.distanceKm)
      .slice(0, 12)
      .map((u) => ({
        name:
          u.unitName.length > 14
            ? u.unitName.slice(0, 14) + "…"
            : u.unitName,
        fullName: u.unitName,
        distanceKm: Math.round(u.distanceKm * 10) / 10,
        engineHours: Math.round(u.engineHours * 10) / 10,
      }));
  }, [data, categoryScopedUnits]);

  const dualAxisChartData = useMemo(() => {
    if (!data) return [];
    return topChartData.map((row) => ({
      name: row.name,
      fullName: row.fullName,
      "Distance (km)": row.distanceKm,
      "Engine hrs": row.engineHours,
    }));
  }, [topChartData]);

  const kpiFleet = useMemo(
    () => aggregateUtilizationFleet(categoryScopedUnits),
    [categoryScopedUnits]
  );

  const distanceBuckets = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === "all") return data.distanceBuckets;
    return buildNaturalBuckets(
      categoryScopedUnits.map((unit) => unit.distanceKm)
    ).map((bucket) => ({ label: bucket.label, count: bucket.count }));
  }, [data, categoryFilter, categoryScopedUnits]);

  const showSkeleton = isLoading && !data;

  if (showSkeleton) {
    return <UtilizationSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[40vh] items-start justify-center">
        <DataLoadError
          title="Utilization could not load"
          message={
            error instanceof Error
              ? error.message
              : "Sheet data did not load for this period."
          }
          hints={VERCEL_SHEETS_HINTS}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  const hasActiveFilters = view !== "all" || categoryFilterActive;
  const kpiDetailSuffix =
    categoryFilter !== "all"
      ? ` · ${categoryFilter} (${kpiFleet.unitCount} units)`
      : "";

  return (
    <div className={cn("space-y-6", isFetching && !isPlaceholderData && "opacity-90")}>
      {hasActiveFilters && (
        <p className="rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
          Showing {filteredUnits.length} of {categoryScopedUnits.length} units
          {view !== "all"
            ? view === "top"
              ? " · top utilized"
              : " · underutilized"
            : ""}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          title="Total distance"
          value={`${formatNumber(kpiFleet.totalDistanceKm, 1)} km`}
          detail={`Fleet mileage in period${kpiDetailSuffix}`}
          icon={<MapPin className="h-4 w-4 text-sky-600" />}
          iconBg="bg-sky-50"
          accent="bg-sky-500"
        />
        <MetricTile
          title="Total engine hours"
          value={`${formatNumber(kpiFleet.totalEngineHours, 1)} hrs`}
          detail={`Runtime across fleet${kpiDetailSuffix}`}
          icon={<Clock className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-50"
          accent="bg-violet-500"
        />
        <MetricTile
          title="Avg km / engine hr"
          value={formatNumber(kpiFleet.avgKmPerEngineHour, 1)}
          detail={`Distance correlated with runtime${kpiDetailSuffix}`}
          icon={<Gauge className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          accent="bg-emerald-500"
        />
        <MetricTile
          title="Idle hours"
          value={`${formatNumber(kpiFleet.totalIdleHours, 1)} hrs`}
          detail={`Productive: ${formatNumber(kpiFleet.totalProductiveHours, 1)} hrs${kpiDetailSuffix}`}
          icon={<Timer className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-50"
          accent="bg-amber-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top utilized vehicles</CardTitle>
            <p className="text-xs text-muted-foreground">
              Distance (km) and engine hours by unit
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {dualAxisChartData.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No utilization data in this period
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dualAxisChartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: CHART.axis }}
                      angle={-35}
                      textAnchor="end"
                      height={56}
                      interval={0}
                    />
                    <YAxis
                      yAxisId="km"
                      tick={{ fontSize: 11, fill: CHART.axis }}
                      width={48}
                    />
                    <YAxis
                      yAxisId="hrs"
                      orientation="right"
                      tick={{ fontSize: 11, fill: CHART.axis }}
                      width={40}
                    />
                    <Tooltip
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { fullName?: string })
                          ?.fullName ?? ""
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      yAxisId="km"
                      dataKey="Distance (km)"
                      fill={CHART.distance}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      yAxisId="hrs"
                      dataKey="Engine hrs"
                      fill={CHART.engine}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilization range distribution</CardTitle>
            <p className="text-xs text-muted-foreground">
              Vehicles grouped by distance travelled
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {distanceBuckets.every((b) => b.count === 0) ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No vehicles in this period
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distanceBuckets}
                    margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: CHART.axis }}
                      angle={-25}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: CHART.axis }}
                    />
                    <Tooltip formatter={(value) => [value, "Vehicles"]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="count"
                      name="Vehicles"
                      fill={CHART.bucket}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <UtilizationPerUnitTable
        title={
          view === "underutilized"
            ? "Underutilized vehicles"
            : view === "top"
              ? "Top utilized vehicles"
              : "Per-unit breakdown"
        }
        rows={filteredUnits}
      />
    </div>
  );
}

function UtilizationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-xl bg-slate-200/60" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/60" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-slate-200/50" />
        <div className="h-80 animate-pulse rounded-xl bg-slate-200/50" />
      </div>
    </div>
  );
}

function MetricTile({
  title,
  value,
  detail,
  icon,
  iconBg,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  iconBg: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className={cn("rounded-lg p-2", iconBg)}>{icon}</div>
        </div>
      </div>
      <div className={cn("h-1 w-full", accent)} />
    </div>
  );
}
