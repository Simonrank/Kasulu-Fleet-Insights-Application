"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { matchesCategoryFilter } from "@/lib/fleet/theft-filters";
import type { VehicleTypeFilter } from "@/lib/fleet/theft-filters";
import { formatNumber } from "@/lib/utils";
import type { UtilizationUnitRow } from "@/lib/types";

type Props = {
  title?: string;
  subtitle?: string;
  rows: UtilizationUnitRow[];
  emptyMessage?: string;
  pageSize?: number;
};

export function filterUtilizationUnits(
  units: UtilizationUnitRow[],
  options: {
    categoryFilter?: VehicleTypeFilter;
    unitCategoryById?: Map<string, string | null>;
  } = {}
): UtilizationUnitRow[] {
  const { categoryFilter = "all", unitCategoryById = new Map() } = options;
  if (categoryFilter === "all") return units;
  return units.filter((unit) =>
    matchesCategoryFilter(
      unitCategoryById.get(unit.unitId) ?? unit.category,
      categoryFilter
    )
  );
}

export function UtilizationPerUnitTable({
  title = "Per-unit breakdown",
  subtitle = "Distance and engine hours",
  rows,
  emptyMessage = "No units match your filters",
  pageSize = 10,
}: Props) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, page, pageSize]);

  return (
    <div className="dash-panel min-w-0 p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 md:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-dash-foreground">
            {title}
            {rows.length > 0 ? ` (${rows.length})` : ""}
          </h3>
          <p className="mt-1 text-xs text-dash-muted">
            {subtitle} · {pageSize} per page
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
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="dash-icon-btn"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto px-4 py-4 md:px-5">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-3 pr-4 font-semibold w-10">#</th>
              <th className="pb-3 pr-4 font-semibold">Vehicle</th>
              <th className="pb-3 pr-4 font-semibold">Category</th>
              <th className="pb-3 pr-4 font-semibold">Distance</th>
              <th className="pb-3 pr-4 font-semibold">Engine hrs</th>
              <th className="pb-3 pr-4 font-semibold">Km / hr</th>
              <th className="pb-3 pr-4 font-semibold">Idle hrs</th>
              <th className="pb-3 pr-4 font-semibold">Fuel consumed</th>
              <th className="pb-3 font-semibold">Violations</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((u, index) => (
              <tr key={u.unitId} className="border-b border-border/60">
                <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                  {page * pageSize + index + 1}
                </td>
                <td className="py-2.5 pr-4 font-medium">{u.unitName}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {u.category ?? "—"}
                </td>
                <td className="py-2.5 pr-4 font-semibold text-sky-700">
                  {formatNumber(u.distanceKm, 1)} km
                </td>
                <td className="py-2.5 pr-4">
                  {formatNumber(u.engineHours, 1)} hrs
                </td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {formatNumber(u.kmPerEngineHour, 1)}
                </td>
                <td className="py-2.5 pr-4">
                  {formatNumber(u.idleHours, 1)} hrs
                </td>
                <td className="py-2.5 pr-4">
                  {formatNumber(u.fuelConsumedLiters, 0)} L
                </td>
                <td className="py-2.5 tabular-nums">{u.violationCount}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {rows.length > 0 && (
          <p className="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, rows.length)} of {rows.length}
          </p>
        )}
      </div>
    </div>
  );
}
