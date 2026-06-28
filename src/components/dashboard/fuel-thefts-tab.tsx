"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TabWorkspace } from "@/components/dashboard/tab-workspace";
import { useFuelThefts } from "@/hooks/use-fleet-data";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import type { DurationBand, TheftFilter } from "@/lib/types";
import {
  DURATION_BANDS,
  buildCategoryFilterOptions,
  filterTheftEvents,
  type VehicleTypeFilter,
} from "@/lib/fleet/theft-filters";
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
import type { FuelFleetRow } from "@/lib/types";

const THEFT_CHART = {
  direct: "#0d9488",
  returnPipe: "#d97706",
  other: "#94a3b8",
  riskBar: "#059669",
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

function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("dash-panel h-full", className)}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-dash-foreground">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-xs text-dash-muted">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function FuelTheftsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-44 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-[8.75rem] animate-pulse rounded-2xl bg-white shadow-sm"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    </div>
  );
}

function FleetMetricsTable({
  title,
  subtitle,
  rows,
  emptyMessage,
  footer,
  pageSize,
}: {
  title: string;
  subtitle?: string;
  rows: FuelFleetRow[];
  emptyMessage: string;
  footer?: React.ReactNode;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  const totalPages = pageSize
    ? Math.max(1, Math.ceil(rows.length / pageSize))
    : 1;
  const visibleRows = pageSize
    ? rows.slice(page * pageSize, page * pageSize + pageSize)
    : rows;

  return (
    <div className="dash-panel overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-5 md:px-6">
        <div>
          <h3 className="text-base font-semibold text-dash-foreground">{title}</h3>
          {(subtitle || pageSize) && (
            <p className="mt-1 text-xs text-dash-muted">
              {subtitle ??
                (pageSize
                  ? `${pageSize} per page · ${rows.length} units total`
                  : undefined)}
            </p>
          )}
        </div>
        {pageSize && rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="dash-icon-btn"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-dash-muted">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="dash-icon-btn"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-[#0d9488] to-[#14b8a6] text-left text-white">
              <th className="px-4 py-3 font-semibold">Reg</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold text-right">
                Distance (km)
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Fuel consumed (L)
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Actual theft (L)
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Return pipe theft (L)
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Total theft (L)
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Consumption (km/L)
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Consumption (Ltrs/Hr)
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.unitId}
                className="border-b border-border/60 transition-colors hover:bg-[#f0fdfa]/50"
              >
                <td className="px-4 py-2.5 font-medium">{row.reg}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline">{row.category}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {formatNumber(row.distanceKm, 0)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {formatNumber(row.fuelConsumedLiters, 0)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right",
                    row.directTheftLiters > 0 && "font-semibold text-destructive"
                  )}
                >
                  {formatNumber(row.directTheftLiters, 0)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right",
                    row.returnPipeTheftLiters > 0 && "font-semibold text-amber-700"
                  )}
                >
                  {formatNumber(row.returnPipeTheftLiters, 0)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-medium",
                    row.totalTheftLiters > 0 && "text-destructive"
                  )}
                >
                  {formatNumber(row.totalTheftLiters, 0)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {formatNumber(row.kmPerLiter, 2)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {formatNumber(row.litersPerHour, 2)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
          {footer}
        </table>
      </div>
    </div>
  );
}

export function FuelTheftsTab({ from, to }: Props) {
  const [type, setType] = useState<TheftFilter>("all");
  const [search, setSearch] = useState("");
  const [durationBand, setDurationBand] = useState<DurationBand>("all");
  const [vehicleType, setVehicleType] = useState<VehicleTypeFilter>("all");
  const { data, isLoading } = useFuelThefts(from, to, type);

  const unitCategoryById = useMemo(() => {
    if (!data) return new Map<string, string | null>();
    return new Map(
      data.fleetTable.map((row) => [
        row.unitId,
        row.category === "—" ? null : row.category,
      ])
    );
  }, [data]);

  const categoryFilterOptions = useMemo(
    () =>
      data
        ? buildCategoryFilterOptions(data.fleetTable.map((r) => ({ category: r.category })))
        : [{ value: "all" as const, label: "All categories" }],
    [data]
  );

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    return filterTheftEvents(data.events, {
      search,
      theftType: type,
      durationBand,
      vehicleType,
      unitCategoryById,
    });
  }, [data, search, type, durationBand, vehicleType, unitCategoryById]);

  const filteredTable = useMemo(() => {
    if (!data) return [];
    let base =
      type === "all"
        ? data.fleetTable
        : data.fleetTable.filter((row) =>
            type === "direct"
              ? row.directTheftLiters > 0
              : row.returnPipeTheftLiters > 0
          );

    if (vehicleType !== "all") {
      base = base.filter((row) => {
        const cat = unitCategoryById.get(row.unitId);
        return cat === vehicleType;
      });
    }

    const query = search.trim().toLowerCase();
    if (query) {
      base = base.filter((row) =>
        [row.reg, row.category].join(" ").toLowerCase().includes(query)
      );
    }

    return [...base].sort((a, b) =>
      a.reg.localeCompare(b.reg, undefined, { sensitivity: "base" })
    );
  }, [data, type, search, vehicleType, unitCategoryById]);

  const topTheftRiskData = useMemo(() => {
    const volumeFor = (row: FuelFleetRow) =>
      type === "direct"
        ? row.directTheftLiters
        : type === "return_pipe"
          ? row.returnPipeTheftLiters
          : row.totalTheftLiters;

    return filteredTable
      .filter((row) => volumeFor(row) > 0)
      .sort((a, b) => volumeFor(b) - volumeFor(a))
      .slice(0, 10)
      .map((row) => {
        const reg = row.reg;
        return {
          name: reg.length > 26 ? `${reg.slice(0, 26)}…` : reg,
          fullName: reg,
          theft: Math.round(volumeFor(row)),
        };
      });
  }, [filteredTable, type]);

  if (isLoading || !data) {
    return <FuelTheftsSkeleton />;
  }

  const { overview } = data;

  const categoryChartData = data.theftByCategory.map((c) => ({
    name: c.category,
    direct: Math.round(c.directLiters),
    returnPipe: Math.round(c.returnPipeLiters),
    total: Math.round(c.totalLiters),
  }));

  const typeMix = [
    {
      label: "Direct theft",
      volumeLiters: data.summary.direct.volumeLiters,
      count: data.summary.direct.count,
    },
    {
      label: "Return pipe",
      volumeLiters: data.summary.returnPipe.volumeLiters,
      count: data.summary.returnPipe.count,
    },
    {
      label: "Other",
      volumeLiters: Math.max(
        0,
        data.summary.total.volumeLiters -
          data.summary.direct.volumeLiters -
          data.summary.returnPipe.volumeLiters
      ),
      count: Math.max(
        0,
        data.summary.total.count -
          data.summary.direct.count -
          data.summary.returnPipe.count
      ),
    },
  ];

  const theftMixChart = [
    {
      name: "Direct theft",
      value: Math.round(data.summary.direct.volumeLiters),
      fill: THEFT_CHART.direct,
    },
    {
      name: "Return pipe",
      value: Math.round(data.summary.returnPipe.volumeLiters),
      fill: THEFT_CHART.returnPipe,
    },
  ].filter((slice) => slice.value > 0);

  const periodLabel = `${format(new Date(from), "dd MMM")} — ${format(new Date(to), "dd MMM yyyy")}`;

  const hasActiveFilters =
    search.length > 0 ||
    durationBand !== "all" ||
    type !== "all" ||
    vehicleType !== "all";

  const totalStolenLiters = data.summary.total.volumeLiters;

  return (
    <div className="dashboard-workspace relative min-h-full">
      <div className="dashboard-workspace__glow pointer-events-none" aria-hidden />

      <div className="relative space-y-8 p-6 md:p-8">
      <TabWorkspace
        title="Kasulu weekly theft workspace"
        periodLabel={periodLabel}
        className="border-[#99f6e4]/60 bg-gradient-to-br from-white via-white to-[#f0fdfa]/50 shadow-md"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Registration, driver, or duration"
        filters={[
          {
            id: "vehicle-type",
            label: "Category",
            value: vehicleType,
            onChange: (v) => setVehicleType(v as VehicleTypeFilter),
            placeholder: "All categories",
            options: categoryFilterOptions.map((o) => ({
              value: o.value,
              label: o.label,
            })),
          },
          {
            id: "theft-type",
            label: "Theft type",
            value: type,
            onChange: (v) => setType(v as TheftFilter),
            placeholder: "All theft types",
            options: [
              { value: "all", label: "All theft types" },
              { value: "direct", label: "Direct thefts only" },
              { value: "return_pipe", label: "Return pipe only" },
            ],
          },
          {
            id: "duration-band",
            label: "Duration band",
            value: durationBand,
            onChange: (v) => setDurationBand(v as DurationBand),
            placeholder: "All duration bands",
            options: DURATION_BANDS.map((b) => ({
              value: b.value,
              label: b.label,
            })),
          },
        ]}
        resultSummary={
          hasActiveFilters
            ? `Showing ${filteredEvents.length} of ${data.events.length} theft events`
            : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard
          title="Total fleet"
          value={String(overview.totalFleet)}
          detail="Registered active units"
          tone="accent"
        />
        <MetricCard
          title="Distance covered"
          value={`${formatNumber(overview.distanceKm, 0)} km`}
          detail="Aggregate fleet mileage"
          tone="neutral"
        />
        <MetricCard
          title="Consumption (km/L)"
          value={`${formatNumber(overview.kmPerLiter, 2)} km/L`}
          detail={`${formatNumber(overview.hoursPerLiter, 2)} hrs/L`}
          tone="accent"
        />
        <MetricCard
          title="Consumption (Ltrs/Hr)"
          value={`${formatNumber(overview.litersPerHour, 2)} L/hr`}
          detail={`${formatNumber(overview.engineHours, 1)} engine hrs`}
          tone="accent"
        />
        <MetricCard
          title="Fuel consumed"
          value={`${formatNumber(overview.fuelConsumedLiters, 0)} L`}
          detail={`${formatNumber(overview.engineHours, 1)} engine hrs`}
          tone="neutral"
        />
        <MetricCard
          title="Direct theft"
          value={`${formatNumber(overview.directTheft.volumeLiters, 0)} L`}
          detail={`${overview.directTheft.count} events in period`}
          tone="danger"
        />
        <MetricCard
          title="Return pipe theft"
          value={`${formatNumber(overview.returnPipeTheft.volumeLiters, 0)} L`}
          detail={`${overview.returnPipeTheft.count} events in period`}
          tone="warning"
        />
        <MetricCard
          title="Fuel filling"
          value={`${formatNumber(overview.fuelFillings.volumeLiters, 0)} L`}
          detail={`${overview.fuelFillings.count} refill events`}
          tone="accent"
        />
        <MetricCard
          title="Fuel drains"
          value={`${formatNumber(overview.fuelDrains.volumeLiters, 0)} L`}
          detail={`${overview.fuelDrains.count} drain events`}
          tone="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Type mix"
          subtitle="Stolen fuel volume and event count by theft type"
        >
          <div className="space-y-3">
            {typeMix.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border px-4 py-3.5",
                  index === 0 &&
                    "border-rose-100 bg-gradient-to-r from-rose-50/80 to-white",
                  index === 1 &&
                    "border-amber-100 bg-gradient-to-r from-amber-50/80 to-white",
                  index === 2 &&
                    "border-slate-200 bg-gradient-to-r from-slate-50/80 to-white"
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-dash-muted">
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-dash-foreground">
                  {formatNumber(item.volumeLiters, 1)} L · {item.count} events
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Direct vs return pipe"
          subtitle="Share of stolen litres in period"
        >
          {theftMixChart.length === 0 ? (
            <p className="py-16 text-center text-sm text-dash-muted">
              No theft recorded in this period
            </p>
          ) : (
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={theftMixChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {theftMixChart.map((slice) => (
                      <Cell key={slice.name} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} L`, "Stolen"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums text-dash-foreground">
                  {formatNumber(totalStolenLiters, 0)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-dash-muted">
                  litres stolen
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Top theft risk vehicles"
          subtitle="Top 10 · share of stolen litres by vehicle"
        >
            {topTheftRiskData.length === 0 ? (
              <p className="py-16 text-center text-sm text-dash-muted">
                No theft recorded for the current filters
              </p>
            ) : (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topTheftRiskData}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={THEFT_CHART.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: THEFT_CHART.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: THEFT_CHART.axis, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: THEFT_CHART.tooltipBg,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                      }}
                      formatter={(value) => [`${value} L`, "Theft"]}
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { fullName?: string })
                          ?.fullName ?? ""
                      }
                    />
                    <Bar
                      dataKey="theft"
                      name="Theft (L)"
                      fill={THEFT_CHART.riskBar}
                      radius={[0, 6, 6, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
        </Panel>

        <Panel
          title="Theft by category"
          subtitle="Heavy machines vs light vehicles"
        >
            {categoryChartData.every((item) => item.total === 0) ? (
              <p className="py-16 text-center text-sm text-dash-muted">
                No category theft data for this period
              </p>
            ) : (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} barGap={4}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={THEFT_CHART.grid}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: THEFT_CHART.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: THEFT_CHART.axis, fontSize: 11 }}
                      unit=" L"
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: THEFT_CHART.tooltipBg,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                      }}
                      formatter={(value) => [`${value} L`, ""]}
                    />
                    <Legend />
                    <Bar
                      dataKey="direct"
                      name="Direct theft"
                      fill={THEFT_CHART.direct}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="returnPipe"
                      name="Return pipe"
                      fill={THEFT_CHART.returnPipe}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
        </Panel>
      </div>

      <FleetMetricsTable
        title="Fleet Fuel &amp; Theft Summary"
        rows={filteredTable}
        pageSize={10}
        emptyMessage="No units match this filter"
        footer={
          <tfoot>
            <tr className="bg-[#f0fdfa]/80 font-semibold text-[#0f766e]">
              <td className="px-4 py-3" colSpan={2}>
                Fleet total
              </td>
              <td className="px-4 py-3 text-right">
                {formatNumber(overview.distanceKm, 0)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatNumber(overview.fuelConsumedLiters, 0)}
              </td>
              <td className="px-4 py-3 text-right text-destructive">
                {formatNumber(overview.directTheft.volumeLiters, 0)}
              </td>
              <td className="px-4 py-3 text-right text-amber-700">
                {formatNumber(overview.returnPipeTheft.volumeLiters, 0)}
              </td>
              <td className="px-4 py-3 text-right text-destructive">
                {formatNumber(overview.fuelDrains.volumeLiters, 0)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatNumber(overview.kmPerLiter, 2)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatNumber(overview.litersPerHour, 2)}
              </td>
            </tr>
          </tfoot>
        }
      />
      </div>
    </div>
  );
}
