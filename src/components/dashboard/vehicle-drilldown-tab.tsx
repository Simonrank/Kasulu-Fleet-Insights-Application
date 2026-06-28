"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Fuel,
  Radio,
  ShieldAlert,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { useFleet, useUnitProblems } from "@/hooks/use-fleet-data";
import { TabWorkspace } from "@/components/dashboard/tab-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UnitProblem } from "@/lib/types";

type Props = {
  from: string;
  to: string;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string | null) => void;
};

const CATEGORY_META: Record<
  UnitProblem["category"],
  { label: string; icon: React.ElementType }
> = {
  connectivity: { label: "Connectivity", icon: Radio },
  status: { label: "Status", icon: Wrench },
  fuel_theft: { label: "Fuel theft", icon: Fuel },
  driver_incident: { label: "Driver incident", icon: ShieldAlert },
  utilization: { label: "Utilization", icon: TrendingDown },
};

const SEVERITY_VARIANT: Record<
  UnitProblem["severity"],
  "destructive" | "warning" | "outline" | "default"
> = {
  critical: "destructive",
  high: "destructive",
  medium: "warning",
  low: "outline",
};

function ProblemRow({ problem }: { problem: UnitProblem }) {
  const meta = CATEGORY_META[problem.category];
  const Icon = meta.icon;

  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{problem.title}</p>
          <Badge variant={SEVERITY_VARIANT[problem.severity]}>
            {problem.severity}
          </Badge>
          <Badge variant="outline">{meta.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{problem.description}</p>
        {problem.occurredAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            {format(new Date(problem.occurredAt), "dd MMM yyyy HH:mm")}
          </p>
        )}
      </div>
    </li>
  );
}

export function VehicleDrilldownTab({
  from,
  to,
  selectedUnitId,
  onSelectUnit,
}: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [connectivity, setConnectivity] = useState("all");
  const { data: fleet, isLoading: fleetLoading } = useFleet();
  const { data: problems, isLoading: problemsLoading } = useUnitProblems(
    selectedUnitId,
    from,
    to
  );

  const filteredUnits = useMemo(() => {
    if (!fleet) return [];
    const query = search.trim().toLowerCase();

    return fleet.units.filter((u) => {
      if (connectivity === "updating" && !u.isUpdating) return false;
      if (connectivity === "non_updating" && u.isUpdating) return false;

      if (!query) return true;
      return [u.plateNumber, u.name, u.driverName, u.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [fleet, search, connectivity]);

  const filteredProblems = useMemo(() => {
    if (!problems) return [];
    const query = search.trim().toLowerCase();

    return problems.problems.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (severity !== "all" && p.severity !== severity) return false;
      if (!query) return true;
      return [p.title, p.description, CATEGORY_META[p.category].label]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [problems, search, category, severity]);

  if (fleetLoading || !fleet) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const hasActiveFilters = selectedUnitId
    ? search.length > 0 || category !== "all" || severity !== "all"
    : search.length > 0 || connectivity !== "all";

  if (!selectedUnitId) {
    return (
      <div className="space-y-6">
        <TabWorkspace
          title="Kasulu unit drilldown workspace"
          from={from}
          to={to}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Vehicle, registration, or driver"
          filters={[
            {
              id: "connectivity",
              label: "Connectivity",
              value: connectivity,
              onChange: setConnectivity,
              placeholder: "All units",
              options: [
                { value: "all", label: "All units" },
                { value: "updating", label: "Updating" },
                { value: "non_updating", label: "Non-updating" },
              ],
            },
          ]}
          resultSummary={
            hasActiveFilters
              ? `Showing ${filteredUnits.length} of ${fleet.units.length} vehicles`
              : undefined
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#0d9488]" />
              Select a vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click a vehicle to view all recorded problems — connectivity,
              fuel theft, driver incidents, and utilization alerts.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUnits.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => onSelectUnit(unit.id)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-[#0d9488] hover:bg-[#f0fdfa]"
                >
                  <p className="font-medium">{unit.plateNumber ?? unit.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {unit.category}
                    {!unit.isUpdating && " · Non-updating"}
                  </p>
                </button>
              ))}
              {filteredUnits.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No vehicles match your search
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loading = problemsLoading || !problems;

  return (
    <div className="space-y-6">
      <TabWorkspace
        title="Kasulu unit drilldown workspace"
        from={from}
        to={to}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Problem title, category, or description"
        filters={[
          {
            id: "category",
            label: "Problem category",
            value: category,
            onChange: setCategory,
            placeholder: "All categories",
            options: [
              { value: "all", label: "All categories" },
              ...Object.entries(CATEGORY_META).map(([value, meta]) => ({
                value,
                label: meta.label,
              })),
            ],
          },
          {
            id: "severity",
            label: "Severity",
            value: severity,
            onChange: setSeverity,
            placeholder: "All severities",
            options: [
              { value: "all", label: "All severities" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ],
          },
        ]}
        resultSummary={
          hasActiveFilters && problems
            ? `Showing ${filteredProblems.length} of ${problems.problems.length} problems`
            : undefined
        }
      />

      <button
        type="button"
        onClick={() => {
          onSelectUnit(null);
          setSearch("");
          setCategory("all");
          setSeverity("all");
          setConnectivity("all");
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to vehicle list
      </button>

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    {problems!.unit.plateNumber ?? problems!.unit.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {problems!.unit.name}
                    {problems!.unit.driverName
                      ? ` · ${problems!.unit.driverName}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{problems!.unit.category}</Badge>
                  <Badge
                    variant={
                      problems!.unit.isUpdating ? "success" : "destructive"
                    }
                  >
                    {problems!.unit.isUpdating ? "Updating" : "Non-updating"}
                  </Badge>
                  <Badge
                    variant={
                      problems!.unit.status === "active"
                        ? "success"
                        : problems!.unit.status === "maintenance"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {problems!.unit.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-5">
                {(
                  [
                    ["Total", problems!.summary.totalProblems, "default"],
                    ["Critical", problems!.summary.critical, "destructive"],
                    ["High", problems!.summary.high, "destructive"],
                    ["Medium", problems!.summary.medium, "warning"],
                    ["Low", problems!.summary.low, "outline"],
                  ] as const
                ).map(([label, count, tone]) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-xl border border-border px-4 py-3",
                      tone === "destructive" &&
                        count > 0 &&
                        "border-red-200 bg-red-50",
                      tone === "warning" &&
                        count > 0 &&
                        "border-amber-200 bg-amber-50"
                    )}
                  >
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-2xl font-bold tabular-nums">{count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All problems ({filteredProblems.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(new Date(problems!.period.from), "dd MMM yyyy")} —{" "}
                {format(new Date(problems!.period.to), "dd MMM yyyy")}
              </p>
            </CardHeader>
            <CardContent>
              {filteredProblems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <p className="font-medium text-emerald-700">
                    {problems!.problems.length === 0
                      ? "No problems found"
                      : "No problems match your filters"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {problems!.problems.length === 0
                      ? "This vehicle has no recorded issues in the selected period."
                      : "Try adjusting your search or filters."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredProblems.map((problem) => (
                    <ProblemRow key={problem.id} problem={problem} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
