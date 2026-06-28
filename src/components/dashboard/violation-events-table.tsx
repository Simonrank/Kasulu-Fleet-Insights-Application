"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import {
  formatDurationHms,
  incidentDurationSeconds,
  incidentEndTime,
  incidentTypeLabel,
} from "@/lib/fleet/violations-model";
import type { DriverIncidentRow } from "@/lib/types";

const PAGE_SIZE = 10;

function locationHref(location: string): string {
  const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return `https://www.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function formatLocation(row: DriverIncidentRow): string | null {
  const loc = row.locationName?.trim();
  if (loc) return loc;
  const desc = row.description ?? "";
  const nearMatch = desc.match(/near '([^']+)'/i);
  if (nearMatch) return nearMatch[1];
  return null;
}

type Props = {
  rows: DriverIncidentRow[];
  selectedType: string;
  onClearFilter: () => void;
};

export function ViolationEventsTable({
  rows,
  selectedType,
  onClearFilter,
}: Props) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [selectedType, rows.length]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [rows, page]
  );

  const showMaxSpeed = rows.some(
    (row) => row.value != null && row.threshold != null
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          {incidentTypeLabel(selectedType).toUpperCase()} · {rows.length}
        </h3>
        <span className="text-xs text-slate-400">{PAGE_SIZE} per page</span>
        <button
          type="button"
          onClick={onClearFilter}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
        >
          <X className="h-3.5 w-3.5" />
          Clear filter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="bg-[#0f172a] text-left text-[11px] font-semibold uppercase tracking-wider text-white">
              <th className="w-12 px-4 py-3">#</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Violation</th>
              {showMaxSpeed && <th className="px-4 py-3">Max speed</th>}
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const start = new Date(row.occurredAt);
              const end = incidentEndTime(row);
              const durationSec = incidentDurationSeconds(row);
              const location = formatLocation(row);
              const rowNum = page * PAGE_SIZE + index + 1;

              return (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 bg-white last:border-0"
                >
                  <td className="px-4 py-3.5 tabular-nums text-slate-500">
                    {rowNum}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">
                    {row.unitName}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">
                    {incidentTypeLabel(row.incidentType)}
                  </td>
                  {showMaxSpeed && (
                    <td className="px-4 py-3.5">
                      {row.value != null && row.value > 0 ? (
                        <span className="font-bold text-emerald-600">
                          {formatNumber(row.value, 0)} km/h
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                    {format(start, "dd MMM yyyy, HH:mm")}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                    {end ? format(end, "dd MMM yyyy, HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">
                    {durationSec > 0 ? formatDurationHms(durationSec) : "—"}
                  </td>
                  <td className="max-w-[280px] px-4 py-3.5">
                    {location ? (
                      <a
                        href={locationHref(location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 text-[#2563eb] hover:underline"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{location}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={showMaxSpeed ? 8 : 7}
                  className={cn("px-4 py-16 text-center text-sm text-slate-500")}
                >
                  No events for this violation type
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">
            Page {page + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
