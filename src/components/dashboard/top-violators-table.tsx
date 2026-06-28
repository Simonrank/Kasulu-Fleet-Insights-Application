"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { UnitPerformance } from "@/lib/types";

const PAGE_SIZE = 10;

type Props = {
  violators: UnitPerformance[];
};

export function TopViolatorsTable({ violators }: Props) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [violators]);

  const totalPages = Math.max(1, Math.ceil(violators.length / PAGE_SIZE));
  const pageItems = violators.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <div className="dash-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-dash-foreground">
            Top violators
          </h3>
          <p className="mt-1 text-xs text-dash-muted">
            Top {PAGE_SIZE} per page · ranked by litres stolen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="dash-icon-btn"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[5rem] text-center text-xs tabular-nums text-dash-muted">
            {violators.length === 0
              ? "0 / 0"
              : `${page + 1} / ${totalPages}`}
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
      </div>

      <ul className="space-y-2">
        {pageItems.map((item) => (
          <li key={item.unitId} className="dash-watchlist-item">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0fdfa] text-sm font-bold text-[#0d9488]">
                {item.rank}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-dash-foreground">
                  {item.unitName}
                </p>
                {item.driverName && (
                  <p className="truncate text-[11px] text-dash-muted">
                    {item.driverName}
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold tabular-nums text-[#dc2626]">
                {formatNumber(item.theftVolumeLiters, 0)} L
              </p>
              <p className="text-[11px] text-dash-muted">
                {item.theftCount} {item.theftCount === 1 ? "event" : "events"}
              </p>
            </div>
          </li>
        ))}
        {pageItems.length === 0 && (
          <li className="py-12 text-center text-sm text-dash-muted">
            No theft violators in this period
          </li>
        )}
      </ul>
    </div>
  );
}
