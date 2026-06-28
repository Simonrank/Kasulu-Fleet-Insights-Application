"use client";

import { format, subDays } from "date-fns";
import { cn, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KpiSummary } from "@/lib/types";
import {
  Activity,
  Fuel,
  Gauge,
  MapPin,
  Radio,
  ShieldAlert,
  Timer,
} from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const UNIT_STATUS_COLORS = {
  updating: "oklch(0.55 0.15 155)",
  nonUpdating: "oklch(0.55 0.2 25)",
};

type Props = {
  data?: KpiSummary;
  loading?: boolean;
};

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  accent?: "green" | "amber" | "red" | "blue";
}) {
  const accentMap = {
    green: "text-success bg-success/10",
    amber: "text-amber-700 bg-warning/15",
    red: "text-destructive bg-destructive/10",
    blue: "text-primary bg-primary/10",
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </CardTitle>
        </div>
        <div className={cn("rounded-lg p-2", accent ? accentMap[accent] : "bg-muted")}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function UnitStatusPieChart({ data }: { data: KpiSummary }) {
  const chartData = [
    {
      name: "Updating",
      value: data.updatingUnits,
      color: UNIT_STATUS_COLORS.updating,
    },
    {
      name: "Non-updating",
      value: data.nonUpdatingUnits,
      color: UNIT_STATUS_COLORS.nonUpdating,
    },
  ].filter((d) => d.value > 0);

  const empty = data.totalUnits === 0;

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>Unit Connectivity</CardTitle>
        <p className="text-xs text-muted-foreground">
          Updating vs non-updating units (last 30 min)
        </p>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No units in fleet
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-52 w-full sm:h-56 sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} unit${value !== 1 ? "s" : ""}`,
                      name,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => (
                      <span className="text-sm text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid w-full gap-3 sm:w-1/2">
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: UNIT_STATUS_COLORS.updating }}
                  />
                  <span className="text-sm font-medium">Updating</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{data.updatingUnits}</p>
                <p className="text-xs text-muted-foreground">
                  {data.totalUnits > 0
                    ? `${formatNumber((data.updatingUnits / data.totalUnits) * 100, 0)}% of fleet`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: UNIT_STATUS_COLORS.nonUpdating }}
                  />
                  <span className="text-sm font-medium">Non-updating</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{data.nonUpdatingUnits}</p>
                <p className="text-xs text-muted-foreground">
                  {data.totalUnits > 0
                    ? `${formatNumber((data.nonUpdatingUnits / data.totalUnits) * 100, 0)}% of fleet`
                    : "—"}
                </p>
              </div>
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                Total fleet: {data.totalUnits} units
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiGrid({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-28" />
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="h-56" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Consumption Rate"
        value={`${formatNumber(data.consumptionKmPerLiter, 2)} km/L`}
        subtitle={`${formatNumber(data.consumptionLitersPerHour, 2)} L/hr`}
        icon={Fuel}
        accent="green"
      />
      <KpiCard
        title="Distance Covered"
        value={`${formatNumber(data.totalDistanceKm, 0)} km`}
        subtitle="Fleet total for period"
        icon={MapPin}
        accent="blue"
      />
      <KpiCard
        title="Engine Hours"
        value={`${formatNumber(data.totalEngineHours, 1)} hrs`}
        subtitle="Total runtime"
        icon={Timer}
        accent="blue"
      />
      <KpiCard
        title="Updating Units"
        value={`${data.updatingUnits} / ${data.totalUnits}`}
        subtitle="Reporting within 30 min"
        icon={Radio}
        accent="green"
      />
      <KpiCard
        title="Non-Updating Units"
        value={String(data.nonUpdatingUnits)}
        subtitle="Requires attention"
        icon={Activity}
        accent={data.nonUpdatingUnits > 0 ? "red" : "green"}
      />
      <KpiCard
        title="Direct Thefts"
        value={`${data.directThefts.count} events`}
        subtitle={`${formatNumber(data.directThefts.volumeLiters, 0)} L lost`}
        icon={ShieldAlert}
        accent="red"
      />
      <KpiCard
        title="Return Pipe Thefts"
        value={`${data.returnPipeThefts.count} events`}
        subtitle={`${formatNumber(data.returnPipeThefts.volumeLiters, 0)} L lost`}
        icon={Gauge}
        accent="red"
      />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UnitStatusPieChart data={data} />
      </div>
    </div>
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

export function defaultDateRange() {
  const to = new Date();
  const from = subDays(to, 7);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
