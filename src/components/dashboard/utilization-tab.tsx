"use client";

import { useMemo, useState } from "react";
import { useUtilization } from "@/hooks/use-fleet-data";
import { TabWorkspace } from "@/components/dashboard/tab-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  from: string;
  to: string;
};

type PerformanceFilter = "all" | "on_target" | "below_target";

export function UtilizationTab({ from, to }: Props) {
  const [search, setSearch] = useState("");
  const [performance, setPerformance] = useState<PerformanceFilter>("all");
  const { data, isLoading } = useUtilization(from, to);

  const filteredUnits = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();

    return data.byUnit.filter((u) => {
      const onTarget = u.utilizationPercent >= data.fleet.targetPercent;
      if (performance === "on_target" && !onTarget) return false;
      if (performance === "below_target" && onTarget) return false;

      if (!query) return true;
      return [u.unitName, u.driverName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, search, performance]);

  if (isLoading || !data) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const { fleet } = data;
  const meetsTarget = fleet.utilizationPercent >= fleet.targetPercent;
  const deviation =
    ((fleet.utilizationPercent - fleet.targetPercent) / fleet.targetPercent) *
    100;

  const chartData = filteredUnits.map((u) => ({
    name: u.unitName.split("—")[0]?.trim() ?? u.unitName,
    utilization: Math.round(u.utilizationPercent * 10) / 10,
    target: fleet.targetPercent,
  }));

  const hasActiveFilters = search.length > 0 || performance !== "all";

  return (
    <div className="space-y-6">
      <TabWorkspace
        title="Kasulu utilization workspace"
        from={from}
        to={to}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Unit or driver"
        filters={[
          {
            id: "performance",
            label: "Performance",
            value: performance,
            onChange: (v) => setPerformance(v as PerformanceFilter),
            placeholder: "All units",
            options: [
              { value: "all", label: "All units" },
              { value: "on_target", label: "On target" },
              { value: "below_target", label: "Below target" },
            ],
          },
        ]}
        resultSummary={
          hasActiveFilters
            ? `Showing ${filteredUnits.length} of ${data.byUnit.length} units`
            : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fleet Utilization
              </CardTitle>
              <p className="mt-3 text-4xl font-bold tracking-tight">
                {formatNumber(fleet.utilizationPercent, 1)}%
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Productive vs engine hours
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg p-2",
                meetsTarget
                  ? "bg-success/10 text-success"
                  : "bg-warning/15 text-amber-700"
              )}
            >
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={meetsTarget ? "success" : "warning"}>
                Target: {formatNumber(fleet.targetPercent, 0)}%
              </Badge>
              <Badge variant="outline">
                {deviation >= 0 ? "+" : ""}
                {formatNumber(deviation, 1)}% vs target
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Engine Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(fleet.engineHours, 1)} hrs
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Total runtime</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Productive Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {formatNumber(fleet.productiveHours, 1)} hrs
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Idle: {formatNumber(fleet.idleHours, 1)} hrs
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilization by Unit</CardTitle>
          <p className="text-xs text-muted-foreground">
            Dashed line = {formatNumber(fleet.targetPercent, 0)}% target
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No units match your filters
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    formatter={(value) => [
                      `${formatNumber(Number(value), 1)}%`,
                      "Utilization",
                    ]}
                  />
                  <Bar
                    dataKey="utilization"
                    fill="oklch(0.45 0.12 155)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Unit Breakdown ({filteredUnits.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Unit</th>
                <th className="pb-2 pr-4 font-medium">Driver</th>
                <th className="pb-2 pr-4 font-medium">Engine hrs</th>
                <th className="pb-2 pr-4 font-medium">Productive hrs</th>
                <th className="pb-2 pr-4 font-medium">Idle hrs</th>
                <th className="pb-2 font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => {
                const onTarget = u.utilizationPercent >= fleet.targetPercent;
                return (
                  <tr key={u.unitId} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-medium">{u.unitName}</td>
                    <td className="py-2.5 pr-4">{u.driverName ?? "—"}</td>
                    <td className="py-2.5 pr-4">{formatNumber(u.engineHours, 1)}</td>
                    <td className="py-2.5 pr-4">
                      {formatNumber(u.productiveHours, 1)}
                    </td>
                    <td className="py-2.5 pr-4">{formatNumber(u.idleHours, 1)}</td>
                    <td className="py-2.5">
                      <Badge variant={onTarget ? "success" : "warning"}>
                        {formatNumber(u.utilizationPercent, 1)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {filteredUnits.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No units match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
