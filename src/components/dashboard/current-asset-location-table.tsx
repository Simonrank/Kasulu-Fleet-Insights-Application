"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Radio } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { UnitLatestRow } from "@/lib/types";

const PAGE_SIZE = 10;

type Props = {
  rows: UnitLatestRow[];
  isLoading?: boolean;
  error?: string | null;
  title?: string;
  loadingMessage?: string;
};

function formatLastMessage(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd.MM.yyyy HH:mm:ss");
}

function formatSpeed(speedKmh: number | null): string {
  if (speedKmh == null || speedKmh <= 0) return "—";
  return `${formatNumber(speedKmh, 0)} km/h`;
}

function mapsUrl(
  locationLabel: string | null,
  lat: number | null,
  lon: number | null
): string | null {
  if (lat != null && lon != null) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }
  if (locationLabel?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel.trim())}`;
  }
  return null;
}

export function CurrentAssetLocationTable({
  rows,
  isLoading = false,
  error = null,
  title = "Current mobile status",
  loadingMessage = "Fetching Current Mobile Status from telematics",
}: Props) {
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const speedA = a.speedKmh ?? -1;
        const speedB = b.speedKmh ?? -1;
        if (speedB !== speedA) return speedB - speedA;
        return a.name.localeCompare(b.name);
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
            <Radio className="h-5 w-5 text-[#2563eb]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-dash-foreground">
              {title}
            </h3>
            <p className="mt-1 text-xs text-dash-muted">
              Live ControlRoom report · {PAGE_SIZE} per page · sorted by speed
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {rows.length} assets
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

      {isLoading ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-dash-foreground">
            Loading live mobile status…
          </p>
          <p className="mt-2 text-xs text-dash-muted">
            {loadingMessage}
          </p>
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-[#0f172a] text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Last message</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Speed</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const href = mapsUrl(
                  row.locationLabel,
                  row.lat,
                  row.lon
                );

                return (
                <tr
                  key={row.unitId}
                  className="border-b border-slate-100 bg-white last:border-0"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {formatLastMessage(row.lastMessageAt)}
                  </td>
                  <td className="px-4 py-3">
                    {row.locationLabel ? (
                      href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-md items-start gap-1.5 text-[#2563eb] hover:underline"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{row.locationLabel}</span>
                        </a>
                      ) : (
                        <span className="inline-flex max-w-md items-start gap-1.5 text-slate-700">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                          <span>{row.locationLabel}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                    {formatSpeed(row.speedKmh)}
                  </td>
                </tr>
              );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className={cn("px-4 py-12 text-center text-sm text-dash-muted")}
                  >
                    No live mobile status data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
