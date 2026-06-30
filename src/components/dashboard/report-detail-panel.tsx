"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, FileSpreadsheet, Gauge, MapPin, ShieldAlert, Fuel } from "lucide-react";
import { useDriverIncidents, useFuelThefts, useLiveUnitLocations, useUtilization } from "@/hooks/use-fleet-data";
import { useFleetCategoryFilter } from "@/context/fleet-category-filter";
import { CurrentAssetLocationTable } from "@/components/dashboard/current-asset-location-table";
import {
  buildFuelSummaryFooter,
  filterFuelFleetRows,
  FleetFuelTheftSummaryTable,
} from "@/components/dashboard/fleet-fuel-theft-summary-table";
import {
  filterUtilizationUnits,
  UtilizationPerUnitTable,
} from "@/components/dashboard/utilization-per-unit-table";
import { Button } from "@/components/ui/button";
import { fetchAndDownloadReport, type ExportFormat, type ExportReportType } from "@/lib/export/csv";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DriverIncidentRow, FuelTheftsResponse, UnitLatestRow } from "@/lib/types";
import { downloadLocationsReport } from "@/lib/export/location-report-client";

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
    title: "Fleet Fuel & Theft Summary",
    description:
      "Per-vehicle fuel consumption, theft volumes, and efficiency for the selected period.",
    icon: Fuel,
  },
  violations: {
    title: "Violations report",
    description:
      "Where each violation occurred and how long it lasted — fuel thefts and driver incidents.",
    icon: ShieldAlert,
  },
  locations: {
    title: "Current asset location",
    description:
      "Live ControlRoom report — asset, last message, location, and speed.",
    icon: MapPin,
  },
  utilization: {
    title: "Utilization report",
    description:
      "Per-vehicle distance, engine hours, fuel consumption, and violations for the selected period.",
    icon: Gauge,
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
  const utilizationQuery = useUtilization(from, to);
  const incidentsQuery = useDriverIncidents(from, to);
  const liveLocationsQuery = useLiveUnitLocations();
  const {
    categoryFilter,
    isActive: categoryFilterActive,
    unitCategoryById,
  } = useFleetCategoryFilter();

  const filteredFuelRows = useMemo(() => {
    if (!fuelQuery.data) return [];
    return filterFuelFleetRows(fuelQuery.data.fleetTable, {
      categoryFilter,
      unitCategoryById,
    });
  }, [fuelQuery.data, categoryFilter, unitCategoryById]);

  const filteredUtilizationRows = useMemo(() => {
    if (!utilizationQuery.data) return [];
    return filterUtilizationUnits(utilizationQuery.data.byUnit, {
      categoryFilter,
      unitCategoryById,
    });
  }, [utilizationQuery.data, categoryFilter, unitCategoryById]);

  const fuelFooterTotals = useMemo(() => {
    if (!fuelQuery.data) return null;
    return buildFuelSummaryFooter(
      fuelQuery.data,
      filteredFuelRows,
      categoryFilterActive
    );
  }, [fuelQuery.data, filteredFuelRows, categoryFilterActive]);

  const isLoading =
    type === "fuel"
      ? (fuelQuery.isLoading && !fuelQuery.data) ||
        (fuelQuery.isFetching && !fuelQuery.data)
      : type === "utilization"
        ? (utilizationQuery.isLoading && !utilizationQuery.data) ||
          (utilizationQuery.isFetching && !utilizationQuery.data)
      : type === "violations"
        ? (fuelQuery.isLoading && !fuelQuery.data) ||
          (incidentsQuery.isLoading && !incidentsQuery.data)
        : liveLocationsQuery.isLoading && !liveLocationsQuery.data;

  if (type === "utilization") {
    return (
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <ExportButtons
            type={type}
            from={from}
            to={to}
            disabled={!utilizationQuery.data}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Period: {periodLabel}
          {categoryFilterActive ? ` · ${categoryFilter}` : ""}
        </p>

        {utilizationQuery.isFetching && utilizationQuery.data && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Updating period…
          </p>
        )}

        {categoryFilterActive && utilizationQuery.data && (
          <p className="rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
            Showing {filteredUtilizationRows.length} of{" "}
            {utilizationQuery.data.byUnit.length} units · {categoryFilter}
          </p>
        )}

        {isLoading ? (
          <div className="h-[28rem] animate-pulse rounded-2xl bg-muted" />
        ) : utilizationQuery.data ? (
          <UtilizationPerUnitTable rows={filteredUtilizationRows} />
        ) : null}
      </div>
    );
  }

  if (type === "fuel") {
    return (
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <ExportButtons type={type} from={from} to={to} disabled={!fuelQuery.data} />
        </div>

        <p className="text-sm text-muted-foreground">
          Period: {periodLabel}
          {categoryFilterActive ? ` · ${categoryFilter}` : ""}
        </p>

        {fuelQuery.isFetching && fuelQuery.data && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Updating period…
          </p>
        )}

        {categoryFilterActive && fuelQuery.data && (
          <p className="rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
            Showing {filteredFuelRows.length} of {fuelQuery.data.fleetTable.length}{" "}
            units · {categoryFilter}
          </p>
        )}

        {isLoading ? (
          <div className="h-[28rem] animate-pulse rounded-2xl bg-muted" />
        ) : fuelQuery.data ? (
          <FleetFuelTheftSummaryTable
            rows={filteredFuelRows}
            footerTotals={fuelFooterTotals}
          />
        ) : null}
      </div>
    );
  }

  if (type === "locations") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <ExportButtons
            type={type}
            from={from}
            to={to}
            locationRows={liveLocationsQuery.data ?? []}
            disabled={liveLocationsQuery.isLoading && !liveLocationsQuery.data}
          />
        </div>
        <CurrentAssetLocationTable
          rows={liveLocationsQuery.data ?? []}
          isLoading={liveLocationsQuery.isLoading && !liveLocationsQuery.data}
          error={
            liveLocationsQuery.isError
              ? liveLocationsQuery.error instanceof Error
                ? liveLocationsQuery.error.message
                : "Failed to load live asset locations"
              : null
          }
          title="Current asset location"
          loadingMessage="Fetching live asset locations from telematics"
        />
      </div>
    );
  }

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
              Period: {periodLabel}
            </p>
          </div>
        </div>
        <ExportButtons type={type} from={from} to={to} />
      </div>

      <div className="px-6 py-5">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        ) : type === "violations" && fuelQuery.data && incidentsQuery.data ? (
          <ViolationsPreview
            fuelEvents={fuelQuery.data.events}
            incidents={incidentsQuery.data.incidents}
          />
        ) : null}
      </div>
    </div>
  );
}

function ExportButtons({
  type,
  from,
  to,
  locationRows,
  disabled = false,
}: {
  type: ExportReportType;
  from: string;
  to: string;
  locationRows?: UnitLatestRow[];
  disabled?: boolean;
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    setError(null);
    setExporting(format);
    try {
      if (type === "locations" && locationRows && locationRows.length > 0) {
        downloadLocationsReport(format, locationRows);
        return;
      }
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
            disabled={disabled || exporting !== null}
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
    title: "Fleet Fuel & Theft Summary",
    description:
      "Per-vehicle fuel consumption, theft volumes, and efficiency for the selected period.",
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
    type: "utilization",
    title: "Utilization report",
    description:
      "Per-vehicle distance, engine hours, fuel consumption, and violations.",
    icon: Gauge,
    cardClass: "bg-emerald-50/80 border-emerald-100",
    iconWrapClass: "bg-emerald-100",
    iconClass: "text-emerald-600",
  },
  {
    type: "locations",
    title: "Current asset location",
    description: "Live ControlRoom report — asset, last message, location, and speed.",
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
