"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { SpeedViolationsSummary } from "@/lib/types";

const CHART = {
  violation: "#7c3aed",
  grid: "#e2e8f0",
  axis: "#64748b",
  tooltipBg: "#ffffff",
};

type Props = {
  data: SpeedViolationsSummary;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: string | null;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function SpeedViolationsChart({
  data,
  isLoading = false,
  isFetching = false,
  error = null,
}: Props) {
  const chartData = useMemo(
    () =>
      data.byUnit.slice(0, 10).map((unit) => ({
        name:
          unit.unitName.length > 14
            ? unit.unitName.slice(0, 14) + "…"
            : unit.unitName,
        fullName: unit.unitName,
        count: unit.count,
        maxSpeed: Math.round(unit.maxSpeedKmh),
        mileage: Math.round(unit.mileageKm * 10) / 10,
        duration: unit.totalDurationMinutes,
      })),
    [data.byUnit]
  );

  return (
    <div className="dash-panel">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-dash-foreground">
            Speeding violations
          </h3>
          <p className="mt-1 text-xs text-dash-muted">
            {data.totalEvents} events · {formatNumber(data.totalMileageKm, 1)}{" "}
            km over limit · top units by violation count
          </p>
        </div>
        {data.speedLimitLabel && (
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            Limit {data.speedLimitLabel}
          </span>
        )}
      </div>

      {isLoading || (isFetching && data.totalEvents === 0) ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-dash-foreground">
            Loading speeding violations…
          </p>
          <p className="mt-2 text-xs text-dash-muted">
            Live report data — each day in the range can take a few minutes.
          </p>
        </div>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600">{error}</p>
      ) : chartData.length === 0 ? (
        <p className="py-16 text-center text-sm text-dash-muted">
          No speeding violations in this period
        </p>
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
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
                contentStyle={{
                  background: CHART.tooltipBg,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  color: "#0f172a",
                  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                }}
                formatter={(value, name) => {
                  if (name === "count") return [value, "Violations"];
                  return [value, String(name)];
                }}
                labelFormatter={(_, payload) =>
                  (payload?.[0]?.payload as { fullName?: string })?.fullName ??
                  ""
                }
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]?.payload) return null;
                  const row = payload[0].payload as {
                    fullName: string;
                    count: number;
                    maxSpeed: number;
                    mileage: number;
                    duration: number;
                  };
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-slate-900">
                        {row.fullName}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {row.count} violations
                      </p>
                      <p className="text-slate-600">
                        Max speed: {row.maxSpeed} km/h
                      </p>
                      <p className="text-slate-600">
                        Duration: {formatDuration(row.duration)}
                      </p>
                      <p className="text-slate-600">
                        Mileage: {formatNumber(row.mileage, 1)} km
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="count"
                fill={CHART.violation}
                radius={[0, 6, 6, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
