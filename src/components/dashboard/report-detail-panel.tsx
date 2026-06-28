"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, FileSpreadsheet, MapPin, ShieldAlert, Fuel } from "lucide-react";
import { useDriverIncidents, useFleet, useFuelThefts } from "@/hooks/use-fleet-data";
import { Button } from "@/components/ui/button";
import { fetchAndDownloadReport, type ExportFormat, type ExportReportType } from "@/lib/export/csv";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DriverIncidentRow, FleetUnitRow, FuelTheftsResponse } from "@/lib/types";

type ReportDetailPanelProps = {
  type: ExportReportType;
  from: string;
  to: string;
  periodLabel: string;
  onClose: () => void;
};

const REPORT_META: Record<
  ExportReportType,
  { title: string; description: string; icon: React.ElementType }
> = {
  fuel: {
    title: "Fuel report",
    description:
      "Per-vehicle fuel consumption (km/L), fill-ups, and drains for the selected period.",
    icon: Fuel,
  },
  violations: {
    title: "Violations report",
    description:
      "Where each violation occurred and how long it lasted — fuel thefts and driver incidents.",
    icon: ShieldAlert,
  },
  locations: {
    title: "Vehicle locations report",
    description:
      "Last known position, connectivity status, and message time per unit.",
    icon: MapPin,
  },
};

export function ReportDetailPanel({
  type,
  from,
  to,
  periodLabel,
  onClose,
}: ReportDetailPanelProps) {
  const meta = REPORT_META[type];
  const Icon = meta.icon;

  const fuelQuery = useFuelThefts(from, to, "all");
  const incidentsQuery = useDriverIncidents(from, to);
  const fleetQuery = useFleet();

  const isLoading =
    type === "fuel"
      ? fuelQuery.isLoading
      : type === "violations"
        ? fuelQuery.isLoading || incidentsQuery.isLoading
        : fleetQuery.isLoading;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Icon className="h-5 w-5 text-[#0d9488]" />
              </div>
              <h2 className="text-xl font-semibold">{meta.title}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {meta.description}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {type === "locations" ? "Live snapshot" : `Period: ${periodLabel}`}
            </p>
          </div>
        </div>
        <ExportButtons type={type} from={from} to={to} />
      </div>

      <div className="px-6 py-5">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        ) : type === "fuel" && fuelQuery.data ? (
          <FuelPreview data={fuelQuery.data} />
        ) : type === "violations" && fuelQuery.data && incidentsQuery.data ? (
          <ViolationsPreview
            fuelEvents={fuelQuery.data.events}
            incidents={incidentsQuery.data.incidents}
          />
        ) : type === "locations" && fleetQuery.data ? (
          <LocationsPreview units={fleetQuery.data.units} />
        ) : null}
      </div>
    </div>
  );
}

function ExportButtons({
  type,
  from,
  to,
}: {
  type: ExportReportType;
  from: string;
  to: string;
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    setError(null);
    setExporting(format);
    try {
      await fetchAndDownloadReport(type, format, from, to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Export as</p>
      <div className="flex flex-wrap justify-end gap-2">
        {(["xlsx", "csv", "pdf"] as ExportFormat[]).map((fmt) => (
          <Button
            key={fmt}
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport(fmt)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting === fmt ? "…" : fmt.toUpperCase()}
          </Button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

function FuelPreview({ data }: { data: FuelTheftsResponse }) {
  const { overview } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fleet units" value={String(overview.totalFleet)} />
        <Stat label="Fuel consumed" value={`${formatNumber(overview.fuelConsumedLiters, 0)} L`} />
        <Stat label="Consumption" value={`${formatNumber(overview.kmPerLiter, 2)} km/L`} />
        <Stat label="Theft events" value={String(overview.directTheft.count + overview.returnPipeTheft.count)} />
      </div>

      <PreviewTable
        title={`Per-vehicle summary (${data.fleetTable.length} units)`}
        headers={["Unit", "Distance", "Fuel (L)", "Km/L", "Thefts (L)"]}
        rows={data.fleetTable.slice(0, 8).map((r) => [
          r.reg,
          `${formatNumber(r.distanceKm, 0)} km`,
          `${formatNumber(r.fuelConsumedLiters, 0)} L`,
          formatNumber(r.kmPerLiter, 2),
          formatNumber(r.totalTheftLiters, 1),
        ])}
      />

      {data.events.length > 0 && (
        <PreviewTable
          title={`Recent theft events (${data.events.length} total)`}
          headers={["Date", "Unit", "Type", "Volume", "Location"]}
          rows={data.events.slice(0, 5).map((e) => [
            format(new Date(e.occurredAt), "dd MMM yyyy HH:mm"),
            e.unitName,
            e.theftType === "return_pipe" ? "Return pipe" : "Direct",
            `${formatNumber(e.volumeLiters, 1)} L`,
            e.locationName,
          ])}
        />
      )}
    </div>
  );
}

function ViolationsPreview({
  fuelEvents,
  incidents,
}: {
  fuelEvents: FuelTheftsResponse["events"];
  incidents: DriverIncidentRow[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Fuel theft events" value={String(fuelEvents.length)} />
        <Stat label="Driver incidents" value={String(incidents.length)} />
        <Stat label="Total violations" value={String(fuelEvents.length + incidents.length)} />
      </div>

      {fuelEvents.length > 0 && (
        <PreviewTable
          title="Fuel theft violations"
          headers={["Date", "Unit", "Volume", "Duration", "Location"]}
          rows={fuelEvents.slice(0, 5).map((e) => [
            format(new Date(e.occurredAt), "dd MMM yyyy HH:mm"),
            e.unitName,
            `${formatNumber(e.volumeLiters, 1)} L`,
            e.durationMinutes != null ? `${e.durationMinutes} min` : "—",
            e.locationName,
          ])}
        />
      )}

      {incidents.length > 0 && (
        <PreviewTable
          title="Driver behaviour violations"
          headers={["Date", "Unit", "Driver", "Type", "Severity"]}
          rows={incidents.slice(0, 5).map((i) => [
            format(new Date(i.occurredAt), "dd MMM yyyy HH:mm"),
            i.unitName,
            i.driverName,
            i.incidentType.replace(/_/g, " "),
            i.severity,
          ])}
        />
      )}

      {fuelEvents.length === 0 && incidents.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No violations recorded for this period.
        </p>
      )}
    </div>
  );
}

function LocationsPreview({ units }: { units: FleetUnitRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total units" value={String(units.length)} />
        <Stat label="Updating" value={String(units.filter((u) => u.isOnline).length)} />
        <Stat label="Non-updating" value={String(units.filter((u) => !u.isOnline).length)} />
      </div>

      <PreviewTable
        title="Current positions"
        headers={["Unit", "Driver", "Connectivity", "Latitude", "Longitude", "Last update"]}
        rows={units.slice(0, 10).map((u) => [
          u.name,
          u.driverName ?? "—",
          u.isOnline ? "Updating" : "Non-updating",
          u.lastLat != null ? u.lastLat.toFixed(5) : "—",
          u.lastLon != null ? u.lastLon.toFixed(5) : "—",
          u.lastMessageAt
            ? format(new Date(u.lastMessageAt), "dd MMM yyyy HH:mm")
            : "—",
        ])}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function PreviewTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | null)[][];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5">
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const REPORT_CARDS: {
  type: ExportReportType;
  title: string;
  description: string;
  icon: React.ElementType;
  cardClass: string;
  iconWrapClass: string;
  iconClass: string;
}[] = [
  {
    type: "fuel",
    title: "Fuel report",
    description:
      "Per-vehicle fuel consumption (km/L), fill-ups, and drains for the selected period.",
    icon: Fuel,
    cardClass: "bg-blue-50/80 border-blue-100",
    iconWrapClass: "bg-blue-100",
    iconClass: "text-blue-600",
  },
  {
    type: "violations",
    title: "Violations report",
    description: "Where each violation occurred and how long it lasted.",
    icon: ShieldAlert,
    cardClass: "bg-violet-50/80 border-violet-100",
    iconWrapClass: "bg-violet-100",
    iconClass: "text-violet-600",
  },
  {
    type: "locations",
    title: "Vehicle locations report",
    description: "Last known position, speed, and message time per unit.",
    icon: MapPin,
    cardClass: "bg-rose-50/80 border-rose-100",
    iconWrapClass: "bg-rose-100",
    iconClass: "text-rose-600",
  },
];

export function ReportCard({
  card,
  onOpen,
}: {
  card: (typeof REPORT_CARDS)[number];
  onOpen: () => void;
}) {
  const Icon = card.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-full flex-col rounded-xl border p-6 text-left shadow-sm transition-shadow hover:shadow-md",
        card.cardClass
      )}
    >
      <div className={cn("mb-5 inline-flex rounded-lg p-2.5", card.iconWrapClass)}>
        <Icon className={cn("h-5 w-5", card.iconClass)} />
      </div>
      <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {card.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#e11d48]">
        Open report
        <span aria-hidden>→</span>
      </span>
    </button>
  );
}
