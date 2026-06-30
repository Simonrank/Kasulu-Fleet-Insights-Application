"use client";

import { cn } from "@/lib/utils";

export type MetricCardTone = "neutral" | "accent" | "danger" | "warning";

type Props = {
  title: string;
  value: string;
  detail?: string;
  tone?: MetricCardTone;
};

export function MetricCard({
  title,
  value,
  detail,
  tone = "neutral",
}: Props) {
  return (
    <div
      className={cn(
        "dash-metric-card",
        tone === "danger" && "dash-metric-card--danger",
        tone === "accent" && "dash-metric-card--accent",
        tone === "warning" && "dash-metric-card--warning",
        tone === "neutral" && "dash-metric-card--neutral"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dash-muted">
        {title}
      </p>
      <p className="dash-metric-card__value">{value}</p>
      {detail && (
        <p className="mt-2 text-[11px] leading-snug text-dash-muted">{detail}</p>
      )}
    </div>
  );
}
