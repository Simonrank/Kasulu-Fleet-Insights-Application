"use client";

import { useMemo, useState } from "react";
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
import { ViolationsReportContent } from "@/components/dashboard/violations-report-content";
import { Button } from "@/components/ui/button";
import { fetchAndDownloadReport, type ExportFormat, type ExportReportType } from "@/lib/export/csv";
import { cn } from "@/lib/utils";
import type { UnitLatestRow } from "@/lib/types";
import { downloadLocationsReport } from "@/lib/export/location-report-client";

type ReportDetailPanelProps = {
  type: ExportReportType;
  from: string;
  to: string;
  periodLabel: string;
  onClose: () => void;
};

export function ReportDetailPanel({
  type,
  from,
  to,
  periodLabel,
  onClose,
}: ReportDetailPanelProps) {
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
        ? incidentsQuery.isLoading && !incidentsQuery.data
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

  if (type === "violations") {
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
            disabled={!incidentsQuery.data}
          />
        </div>

        <p className="text-sm text-muted-foreground">Period: {periodLabel}</p>

        <ViolationsReportContent from={from} to={to} />
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

  return null;
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
    description:
      "Speed bands, power disconnection, and vehicle event details with export.",
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
