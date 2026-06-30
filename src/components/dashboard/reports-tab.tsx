"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ReportCard,
  ReportDetailPanel,
  REPORT_CARDS,
} from "@/components/dashboard/report-detail-panel";
import type { ExportReportType } from "@/lib/export/csv";

type Props = {
  from: string;
  to: string;
};

export function ReportsTab({ from, to }: Props) {
  const [activeReport, setActiveReport] = useState<ExportReportType | null>(
    null
  );

  const periodLabel = `${format(new Date(from), "dd MMM yyyy HH:mm")} — ${format(new Date(to), "dd MMM yyyy HH:mm")}`;

  if (activeReport) {
    return (
      <ReportDetailPanel
        type={activeReport}
        from={from}
        to={to}
        periodLabel={periodLabel}
        onClose={() => setActiveReport(null)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <p className="text-sm text-muted-foreground">
        Report period: {periodLabel}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORT_CARDS.map((card) => (
          <ReportCard
            key={card.type}
            card={card}
            onOpen={() => setActiveReport(card.type)}
          />
        ))}
      </div>
    </div>
  );
}
