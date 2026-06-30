"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDriverIncidents } from "@/hooks/use-fleet-data";
import { ViolationEventsTable } from "@/components/dashboard/violation-events-table";
import { ViolationOverviewCards } from "@/components/dashboard/violation-overview-cards";
import {
  matchesViolationGroup,
  summarizeViolationGroups,
  totalIncidentDurationSeconds,
} from "@/lib/fleet/violations-model";

type Props = {
  from: string;
  to: string;
};

export function ViolationsReportContent({ from, to }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isFetching, error } = useDriverIncidents(from, to);

  const incidents = useMemo(() => data?.incidents ?? [], [data?.incidents]);

  const selectViolationType = useCallback((type: string) => {
    setSelectedType(type);
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const clearViolationType = useCallback(() => {
    setSelectedType(null);
  }, []);

  useEffect(() => {
    setSelectedType(null);
  }, [from, to]);

  const typeSummaries = useMemo(
    () => summarizeViolationGroups(incidents),
    [incidents]
  );

  const totalDuration = useMemo(
    () => totalIncidentDurationSeconds(incidents),
    [incidents]
  );

  const detailRows = useMemo(() => {
    if (!selectedType) return [];
    return incidents.filter((row) => matchesViolationGroup(row, selectedType));
  }, [incidents, selectedType]);

  if ((isLoading && !data) || (isFetching && !data)) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading live telematics violations… first load can take 20–30 seconds.
        </div>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof Error ? error.message : "Failed to load violations"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {(isFetching || data?.source === "live") && (
        <p className="rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
          {isFetching
            ? "Refreshing violations…"
            : `${incidents.length} live telematics violations in this period`}
        </p>
      )}

      <ViolationOverviewCards
        totalCount={incidents.length}
        totalDurationSeconds={totalDuration}
        summaries={typeSummaries}
        selectedType={selectedType}
        onSelect={selectViolationType}
        showSummaryTotals={false}
      />

      {selectedType ? (
        <div ref={detailsRef}>
          <ViolationEventsTable
            rows={detailRows}
            selectedType={selectedType}
            onClearFilter={clearViolationType}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Select a speed band, low power / power disconnection, or other
            violations above
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Vehicle events will appear here — unit, times, duration, and location
          </p>
        </div>
      )}
    </div>
  );
}
