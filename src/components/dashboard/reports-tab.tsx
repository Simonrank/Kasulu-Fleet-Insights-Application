"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useReports } from "@/hooks/use-fleet-data";
import { TabWorkspace } from "@/components/dashboard/tab-workspace";
import {
  ReportCard,
  ReportDetailPanel,
  REPORT_CARDS,
} from "@/components/dashboard/report-detail-panel";
import type { ExportReportType } from "@/lib/export/csv";
import type { ReportSummary } from "@/lib/types";

const PERIODS: ReportSummary["period"][] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

export function ReportsTab() {
  const [period, setPeriod] = useState<ReportSummary["period"]>("weekly");
  const [activeReport, setActiveReport] = useState<ExportReportType | null>(
    null
  );
  const { data, isLoading } = useReports(period);

  if (isLoading || !data) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const periodLabel = `${format(new Date(data.from), "dd MMM yyyy")} — ${format(new Date(data.to), "dd MMM yyyy")}`;

  return (
    <div className="space-y-6">
      <TabWorkspace
        title="Reports"
        periodLabel={`${period.charAt(0).toUpperCase() + period.slice(1)} · ${periodLabel}`}
        search=""
        onSearchChange={() => {}}
        hideSearch
        filters={[
          {
            id: "period",
            label: "Report period",
            value: period,
            onChange: (v) => setPeriod(v as ReportSummary["period"]),
            placeholder: "Weekly",
            options: PERIODS.map((p) => ({
              value: p,
              label: p.charAt(0).toUpperCase() + p.slice(1),
            })),
          },
        ]}
      />

      {activeReport ? (
        <ReportDetailPanel
          type={activeReport}
          from={data.from}
          to={data.to}
          periodLabel={periodLabel}
          onClose={() => setActiveReport(null)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {REPORT_CARDS.map((card) => (
            <ReportCard
              key={card.type}
              card={card}
              onOpen={() => setActiveReport(card.type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
