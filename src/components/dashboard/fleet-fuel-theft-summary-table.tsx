"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { filterFleetTableByCategory } from "@/lib/fleet/category-kpis";
import type { VehicleTypeFilter } from "@/lib/fleet/theft-filters";
import { cn, formatNumber } from "@/lib/utils";
import type { FuelFleetRow, FuelTheftsResponse, TheftFilter } from "@/lib/types";
type Props = {
  title?: string;
  rows: FuelFleetRow[];
  emptyMessage?: string;
  pageSize?: number;
  footerTotals?: {
    distanceKm: number;
    fuelConsumedLiters: number;
    directTheftLiters: number;
    returnPipeTheftLiters: number;
    totalTheftLiters: number;
    kmPerLiter: number;
    litersPerHour: number;
  } | null;
};

export function sumFleetTable(rows: FuelFleetRow[]) {
  const distanceKm = rows.reduce((sum, row) => sum + row.distanceKm, 0);
  const fuelConsumedLiters = rows.reduce(
    (sum, row) => sum + row.fuelConsumedLiters,
    0
  );
  const engineHours = rows.reduce((sum, row) => sum + row.engineHours, 0);
  const directTheftLiters = rows.reduce(
    (sum, row) => sum + row.directTheftLiters,
    0
  );
  const returnPipeTheftLiters = rows.reduce(
    (sum, row) => sum + row.returnPipeTheftLiters,
    0
  );
  const totalTheftLiters = rows.reduce(
    (sum, row) => sum + row.totalTheftLiters,
    0
  );

  return {
    distanceKm,
    fuelConsumedLiters,
    directTheftLiters,
    returnPipeTheftLiters,
    totalTheftLiters,
    kmPerLiter: fuelConsumedLiters > 0 ? distanceKm / fuelConsumedLiters : 0,
    litersPerHour: engineHours > 0 ? fuelConsumedLiters / engineHours : 0,
  };
}

export function buildFuelSummaryFooter(
  data: FuelTheftsResponse,
  rows: FuelFleetRow[],
  filtered: boolean
) {
  if (!filtered) {
    const { overview } = data;
    return {
      distanceKm: overview.distanceKm,
      fuelConsumedLiters: overview.fuelConsumedLiters,
      directTheftLiters: overview.directTheft.volumeLiters,
      returnPipeTheftLiters: overview.returnPipeTheft.volumeLiters,
      totalTheftLiters: overview.fuelDrains.volumeLiters,
      kmPerLiter: overview.kmPerLiter,
      litersPerHour: overview.litersPerHour,
    };
  }
  return sumFleetTable(rows);
}

export function filterFuelFleetRows(
  fleetTable: FuelFleetRow[],
  options: {
    theftType?: TheftFilter;
    categoryFilter?: VehicleTypeFilter;
    unitCategoryById?: Map<string, string | null>;
  } = {}
): FuelFleetRow[] {
  const {
    theftType = "all",
    categoryFilter = "all",
    unitCategoryById = new Map(),
  } = options;

  let base = filterFleetTableByCategory(
    fleetTable,
    categoryFilter,
    unitCategoryById
  );

  if (theftType !== "all") {
    base = base.filter((row) =>
      theftType === "direct"
        ? row.directTheftLiters > 0
        : row.returnPipeTheftLiters > 0
    );
  }

  return [...base].sort((a, b) =>
    a.reg.localeCompare(b.reg, undefined, { sensitivity: "base" })
  );
}

export function FleetFuelTheftSummaryTable({
  title = "Fleet Fuel & Theft Summary",
  rows,
  emptyMessage = "No units match this filter",
  pageSize = 10,
  footerTotals,
}: Props) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  const footer = useMemo(
    () =>
      footerTotals ? (
        <tfoot>
          <tr className="bg-[#f0fdfa]/80 font-semibold text-[#0f766e]">
            <td className="px-2 py-2.5 md:px-3" colSpan={2}>
              Fleet total
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums md:px-3">
              {formatNumber(footerTotals.distanceKm, 0)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums md:px-3">
              {formatNumber(footerTotals.fuelConsumedLiters, 0)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums text-destructive md:px-3">
              {formatNumber(footerTotals.directTheftLiters, 0)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums text-amber-700 md:px-3">
              {formatNumber(footerTotals.returnPipeTheftLiters, 0)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums text-destructive md:px-3">
              {formatNumber(footerTotals.totalTheftLiters, 0)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums md:px-3">
              {formatNumber(footerTotals.kmPerLiter, 2)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums md:px-3">
              {formatNumber(footerTotals.litersPerHour, 2)}
            </td>
          </tr>
        </tfoot>
      ) : null,
    [footerTotals]
  );

  return (
    <div className="dash-panel min-w-0 p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 md:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-dash-foreground">{title}</h3>
          <p className="mt-1 text-xs text-dash-muted">
            {pageSize} per page · {rows.length} units total
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
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
        <table className="w-full table-fixed text-xs md:text-sm">
          <colgroup>
            <col className="w-[21%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className="bg-gradient-to-r from-[#0d9488] to-[#14b8a6] text-left text-white">
              <th className="px-2 py-2 font-semibold md:px-3 md:py-2.5">Reg</th>
              <th className="px-2 py-2 font-semibold md:px-3 md:py-2.5">Category</th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Distance (km)">
                Dist (km)
              </th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Fuel consumed (L)">
                Fuel (L)
              </th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Actual theft (L)">
                Direct (L)
              </th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Return pipe theft (L)">
                Return (L)
              </th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Total theft (L)">
                Total (L)
              </th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Consumption (km/L)">
                km/L
              </th>
              <th className="px-2 py-2 text-right font-semibold md:px-3 md:py-2.5" title="Consumption (L/hr)">
                L/hr
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.unitId}
                className="border-b border-border/60 transition-colors hover:bg-[#f0fdfa]/50"
              >
                <td className="truncate px-2 py-2 font-medium md:px-3" title={row.reg}>
                  {row.reg}
                </td>
                <td className="px-2 py-2 md:px-3">
                  <Badge variant="outline" className="max-w-full truncate text-[10px] md:text-xs">
                    {row.category}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right tabular-nums md:px-3">
                  {formatNumber(row.distanceKm, 0)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums md:px-3">
                  {formatNumber(row.fuelConsumedLiters, 0)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right tabular-nums md:px-3",
                    row.directTheftLiters > 0 && "font-semibold text-destructive"
                  )}
                >
                  {formatNumber(row.directTheftLiters, 0)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right tabular-nums md:px-3",
                    row.returnPipeTheftLiters > 0 && "font-semibold text-amber-700"
                  )}
                >
                  {formatNumber(row.returnPipeTheftLiters, 0)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right tabular-nums font-medium md:px-3",
                    row.totalTheftLiters > 0 && "text-destructive"
                  )}
                >
                  {formatNumber(row.totalTheftLiters, 0)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums md:px-3">
                  {formatNumber(row.kmPerLiter, 2)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums md:px-3">
                  {formatNumber(row.litersPerHour, 2)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
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