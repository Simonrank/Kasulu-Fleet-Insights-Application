"use client";

import { format } from "date-fns";
import { Radio, Fuel, Gauge, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  connectivityBandBadgeVariant,
  connectivityBandLabel,
} from "@/lib/fleet/connectivity";
import { formatNumber } from "@/lib/utils";
import type { FleetUnitRow, FuelFleetRow, FuelTheftDetail } from "@/lib/types";

type Props = {
  unit: FleetUnitRow;
  metrics: FuelFleetRow | undefined;
  events: FuelTheftDetail[];
  from: string;
  to: string;
};

export function VehicleDetailPanel({ unit, metrics, events, from, to }: Props) {
  const title = unit.plateNumber ?? unit.name.split("—")[0]?.trim() ?? unit.name;

  return (
    <div className="dash-panel border-[#99f6e4] bg-gradient-to-br from-[#f0fdfa] to-white">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">
            Selected vehicle
          </p>
          <h3 className="mt-1 text-xl font-bold text-dash-foreground">{title}</h3>
          {unit.plateNumber && unit.name !== unit.plateNumber && (
            <p className="mt-1 text-sm text-dash-muted">{unit.name}</p>
          )}
          <p className="mt-1 text-xs text-dash-muted">
            {format(new Date(from), "dd MMM yyyy")} —{" "}
            {format(new Date(to), "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{unit.category}</Badge>
          <Badge variant={connectivityBandBadgeVariant(unit.connectivityBand)}>
            {connectivityBandLabel(unit.connectivityBand)}
          </Badge>
          <Badge
            variant={
              unit.status === "active"
                ? "success"
                : unit.status === "maintenance"
                  ? "warning"
                  : "outline"
            }
          >
            {unit.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={MapPin}
          label="Distance"
          value={`${formatNumber(metrics?.distanceKm ?? 0, 0)} km`}
        />
        <Stat
          icon={Gauge}
          label="Engine hours"
          value={`${formatNumber(metrics?.engineHours ?? 0, 1)} hrs`}
        />
        <Stat
          icon={Fuel}
          label="Fuel consumed"
          value={`${formatNumber(metrics?.fuelConsumedLiters ?? 0, 1)} L`}
        />
        <Stat
          icon={Radio}
          label="Last update"
          value={
            unit.lastMessageAt
              ? format(new Date(unit.lastMessageAt), "dd MMM yyyy HH:mm")
              : "—"
          }
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric
          label="Consumption"
          value={`${formatNumber(metrics?.kmPerLiter ?? 0, 2)} km/L`}
        />
        <MiniMetric
          label="Ltrs / hr"
          value={`${formatNumber(metrics?.litersPerHour ?? 0, 2)} L/hr`}
        />
        <MiniMetric
          label="Direct theft"
          value={`${formatNumber(metrics?.directTheftLiters ?? 0, 1)} L`}
        />
        <MiniMetric
          label="Return pipe theft"
          value={`${formatNumber(metrics?.returnPipeTheftLiters ?? 0, 1)} L`}
        />
      </div>

      {(unit.driverName || unit.vehicleType) && (
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {unit.driverName && (
            <div>
              <dt className="text-xs text-dash-muted">Driver</dt>
              <dd className="font-medium">{unit.driverName}</dd>
            </div>
          )}
          {unit.vehicleType && (
            <div>
              <dt className="text-xs text-dash-muted">Type</dt>
              <dd className="font-medium">{unit.vehicleType}</dd>
            </div>
          )}
        </dl>
      )}

      {events.length > 0 && (
        <div className="mt-6 border-t border-border/60 pt-5">
          <h4 className="text-sm font-semibold text-dash-foreground">
            Theft events in period ({events.length})
          </h4>
          <ul className="mt-3 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-white px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-dash-muted">
                    {format(new Date(event.occurredAt), "dd MMM yyyy HH:mm")}
                  </span>
                  {event.description && (
                    <span className="text-dash-muted"> · {event.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      event.theftType === "return_pipe" ? "warning" : "destructive"
                    }
                  >
                    {event.theftType === "return_pipe" ? "Return pipe" : "Direct"}
                  </Badge>
                  <span className="font-semibold tabular-nums text-[#dc2626]">
                    {formatNumber(event.volumeLiters, 1)} L
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4">
      <div className="flex items-center gap-2 text-dash-muted">
        <Icon className="h-4 w-4 text-[#0d9488]" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums text-dash-foreground">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dash-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-dash-foreground">{value}</p>
    </div>
  );
}
