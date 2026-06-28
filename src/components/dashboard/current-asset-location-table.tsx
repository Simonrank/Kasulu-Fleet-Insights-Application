"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import type { UnitLatestRow } from "@/lib/types";

const PAGE_SIZE = 10;

type Props = {
  rows: UnitLatestRow[];
};

function mapsUrl(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

export function CurrentAssetLocationTable({ rows }: Props) {
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const speedA = a.speedKmh ?? -1;
        const speedB = b.speedKmh ?? -1;
        if (speedB !== speedA) return speedB - speedA;
        return a.reg.localeCompare(b.reg);
      }),
    [rows]
  );

  useEffect(() => {
    setPage(0);
  }, [sortedRows.length]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <div className="dash-panel overflow-hidden">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe]">
            <MapPin className="h-5 w-5 text-[#2563eb]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-dash-foreground">
              Current asset location
            </h3>
            <p className="mt-1 text-xs text-dash-muted">
              Latest unit data · top {PAGE_SIZE} per page · sorted by speed
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {rows.length} vehicles total
          </span>
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
              {rows.length === 0 ? "0 / 0" : `${page + 1} / ${totalPages}`}
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
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[#0f172a] text-left text-[11px] font-semibold uppercase tracking-wider text-white">
              <th className="w-12 px-4 py-3">#</th>
              <th className="px-4 py-3">Reg no.</th>
              <th className="px-4 py-3">Last message</th>
              <th className="px-4 py-3">Current location</th>
              <th className="px-4 py-3">Speed</th>
              <th className="px-4 py-3 text-right">Distance (km)</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const href = mapsUrl(row.lat, row.lon);

              return (
                <tr
                  key={row.unitId}
                  className="border-b border-slate-100 bg-white last:border-0"
                >
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {page * PAGE_SIZE + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.reg}</p>
                    {row.name !== row.reg && (
                      <p className="text-xs text-slate-500">{row.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.lastMessageAt
                      ? format(new Date(row.lastMessageAt), "dd MMM yyyy, HH:mm")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.locationLabel ? (
                      href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-[240px] items-center gap-1.5 truncate text-[#2563eb] hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{row.locationLabel}</span>
                        </a>
                      ) : (
                        <span className="inline-flex max-w-[240px] items-center gap-1.5 truncate text-slate-700">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                          <span className="truncate">{row.locationLabel}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.speedKmh != null && row.speedKmh > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 font-semibold text-emerald-700"
                      >
                        {formatNumber(row.speedKmh, 0)} km/h
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                    {formatNumber(row.distanceKm, 2)}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className={cn("px-4 py-12 text-center text-sm text-dash-muted")}
                >
                  No latest unit data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
