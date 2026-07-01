"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SheetReportingDateRange } from "@/lib/google-sheets/date-range";
import {
  darDayKey,
  presetReportingRange,
  reportingDayEndIso,
} from "@/lib/google-sheets/reporting-date-range";
import { darCalendarParts } from "@/lib/wialon/day-interval";

type Preset = "today" | "7d" | "30d" | "custom";

type Props = {
  sheetDateRange?: SheetReportingDateRange;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  extraFilters?: React.ReactNode;
};

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

export function AnalysisWindowBar({
  sheetDateRange,
  from,
  to,
  onApply,
  onRefresh,
  isRefreshing = false,
  extraFilters,
}: Props) {
  const [preset, setPreset] = useState<Preset>("7d");
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const applyPreset = useCallback(
    (next: Exclude<Preset, "custom">) => {
      const anchorTo = sheetDateRange?.defaultTo ?? new Date().toISOString();
      const range = presetReportingRange(
        next,
        anchorTo,
        sheetDateRange?.minDate
          ? new Date(`${sheetDateRange.minDate}T00:00:00`).toISOString()
          : undefined
      );
      setPreset(next);
      setDraftFrom(range.from);
      setDraftTo(range.to);
      onApply(range.from, range.to);
    },
    [onApply, sheetDateRange]
  );

  const handleRun = () => {
    onApply(draftFrom, draftTo);
  };

  const handleSameDay = () => {
    if (!draftFrom) return;
    setPreset("custom");
    setDraftTo(reportingDayEndIso(draftFrom));
  };

  const handleFromChange = (value: string) => {
    const nextFrom = fromDatetimeLocalValue(value);
    setPreset("custom");
    setDraftFrom(nextFrom);

    if (!draftTo) {
      setDraftTo(reportingDayEndIso(nextFrom));
      return;
    }

    const fromKey = darDayKey(darCalendarParts(new Date(nextFrom)));
    const toKey = darDayKey(darCalendarParts(new Date(draftTo)));
    if (toKey < fromKey) {
      setDraftTo(reportingDayEndIso(nextFrom));
    }
  };

  const minDate = sheetDateRange?.minDate;
  const maxDate = sheetDateRange?.maxDate;

  return (
    <div className="analysis-window shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 md:px-6">
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Analysis window
          </p>
          <div className="flex flex-nowrap items-center gap-2">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPreset(item.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  preset === item.id
                    ? "bg-[#0f172a] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {extraFilters ? (
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {extraFilters}
          </div>
        ) : (
          <div className="hidden lg:block" aria-hidden />
        )}

        <div className="flex flex-wrap items-end gap-3 lg:justify-end">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <Calendar className="h-3 w-3" />
              From
            </label>
            <input
              type="datetime-local"
              value={draftFrom ? toDatetimeLocalValue(draftFrom) : ""}
              min={minDate ? `${minDate}T00:00` : undefined}
              max={maxDate ? `${maxDate}T23:59` : undefined}
              onChange={(e) => handleFromChange(e.target.value)}
              className="dash-date-input h-9 min-w-[11.5rem] rounded-lg px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <Calendar className="h-3 w-3" />
              To
            </label>
            <input
              type="datetime-local"
              value={draftTo ? toDatetimeLocalValue(draftTo) : ""}
              min={minDate ? `${minDate}T00:00` : undefined}
              max={maxDate ? `${maxDate}T23:59` : undefined}
              onChange={(e) => {
                setPreset("custom");
                setDraftTo(fromDatetimeLocalValue(e.target.value));
              }}
              className="dash-date-input h-9 min-w-[11.5rem] rounded-lg px-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleSameDay}
            disabled={!draftFrom}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            title="Set TO to the end of the same day as FROM"
          >
            Same day
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0d9488] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f766e]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Run analysis
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            aria-label="Refresh data"
            title="Refresh"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
