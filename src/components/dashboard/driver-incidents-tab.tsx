"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useDriverIncidents } from "@/hooks/use-fleet-data";
import { ViolationEventsTable } from "@/components/dashboard/violation-events-table";
import { ViolationOverviewCards } from "@/components/dashboard/violation-overview-cards";
import {
  incidentTypeLabel,
  matchesViolationGroup,
  summarizeViolationGroups,
  totalIncidentDurationSeconds,
  violationGroupLabel,
  violationTypeColor,
} from "@/lib/fleet/violations-model";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  from: string;
  to: string;
  isDefault24h?: boolean;
};

const CHART = {
  grid: "#e2e8f0",
  axis: "#64748b",
};

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dash-panel min-w-0">
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

export function DriverIncidentsTab({ from, to, isDefault24h = false }: Props) {
  const [search, setSearch] = useState("");
  const [incidentType, setIncidentType] = useState("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isFetching, error } = useDriverIncidents(from, to);

  const incidents = useMemo(() => data?.incidents ?? [], [data?.incidents]);

  const selectViolationType = useCallback((type: string) => {
    setSelectedType(type);
    setIncidentType(type);
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const clearViolationType = useCallback(() => {
    setSelectedType(null);
    setIncidentType("all");
  }, []);

  useEffect(() => {
    setSelectedType(null);
    setIncidentType("all");
  }, [from, to]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents.filter((row) => {
      if (!query) return true;

      const typeLabel = incidentTypeLabel(row.incidentType);
      return [row.unitName, row.driverName, typeLabel, row.locationName, row.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [incidents, search]);

  const typeSummaries = useMemo(
    () => summarizeViolationGroups(filteredRows),
    [filteredRows]
  );

  const totalDuration = useMemo(
    () => totalIncidentDurationSeconds(filteredRows),
    [filteredRows]
  );

  const detailRows = useMemo(() => {
    if (!selectedType) return [];
    return filteredRows.filter((row) => matchesViolationGroup(row, selectedType));
  }, [filteredRows, selectedType]);

  const typeChartData = useMemo(() => {
    return typeSummaries.map((item) => ({
      name: item.label,
      typeKey: item.type,
      value: item.count,
      fill: violationTypeColor(item.type),
    }));
  }, [typeSummaries]);

  const topUnitsData = useMemo(() => {
    const counts = new Map<string, { unitName: string; count: number }>();
    for (const row of incidents) {
      const key = row.unitName;
      const entry = counts.get(key) ?? { unitName: row.unitName, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [incidents]);

  const hasActiveFilters =
    search.length > 0 ||
    selectedType != null;

  if ((isLoading && !data) || (isFetching && !data)) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading live telematics violations… first load can take 20–30 seconds
          while Wialon reports are fetched.
        </div>
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Search className="h-3 w-3" />
            Search
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Unit, violation type, location…"
            className="dash-date-input h-9 w-full rounded-lg px-3 text-sm"
          />
        </div>
      </div>

      {(hasActiveFilters ||
        isDefault24h ||
        data?.source === "live") && (
        <p className="rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
          {hasActiveFilters
            ? `Showing ${filteredRows.length} of ${incidents.length} violations`
            : isDefault24h
              ? "Last 24 hours · live telematics · change dates above for earlier days"
              : "Live telematics"}
        </p>
      )}

      {(isFetching || isLoading) && (
        <p className="text-xs text-dash-muted">
          {isFetching ? "Refreshing violations…" : "Loading…"}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load violations"}
        </p>
      )}

      <ViolationOverviewCards
        totalCount={filteredRows.length}
        totalDurationSeconds={totalDuration}
        summaries={typeSummaries}
        selectedType={selectedType}
        onSelect={selectViolationType}
      />

      {selectedType ? (
        <div ref={detailsRef}>
          <ViolationEventsTable
            rows={detailRows}
            selectedType={selectedType}
            onClearFilter={clearViolationType}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Select a speed band, power disconnection, or other violations above,
            or click a chart segment
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Event details will appear here — unit, times, duration, and location
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Violations by category"
          subtitle="Speed bands and power disconnection · click to filter the table"
        >
          {typeChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-dash-muted">
              No violations in this period
            </p>
          ) : (
            <>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={92}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {typeChartData.map((entry) => (
                        <Cell
                          key={entry.typeKey}
                          fill={entry.fill}
                          stroke={
                            selectedType === entry.typeKey ? "#0f172a" : "none"
                          }
                          strokeWidth={selectedType === entry.typeKey ? 2 : 0}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          onClick={() => selectViolationType(entry.typeKey)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const payload = props.payload as { name?: string };
                        return [value, payload.name ?? "Violations"];
                      }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-2 px-1 pb-1 text-xs text-dash-muted">
                {typeChartData.map((item) => (
                  <button
                    key={item.typeKey}
                    type="button"
                    onClick={() => selectViolationType(item.typeKey)}
                    className={
                      selectedType === item.typeKey
                        ? "flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-800"
                        : "flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-slate-100"
                    }
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: item.fill }}
                    />
                    <span className="truncate">
                      {item.name} ({item.value})
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Top units by violations"
          subtitle="Units with the most events in the period"
        >
          {topUnitsData.length === 0 ? (
            <p className="py-16 text-center text-sm text-dash-muted">
              No unit data
            </p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topUnitsData.map((u) => ({
                    name:
                      u.unitName.length > 12
                        ? u.unitName.slice(0, 12) + "…"
                        : u.unitName,
                    fullName: u.unitName,
                    count: u.count,
                  }))}
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
                    allowDecimals={false}
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { fullName?: string })
                        ?.fullName ?? ""
                    }
                    formatter={(value) => [value, "Violations"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#7c3aed"
                    radius={[0, 6, 6, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
