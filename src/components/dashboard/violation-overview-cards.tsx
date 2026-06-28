"use client";

import { AlertTriangle, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorFromKey } from "@/lib/data-driven/colors";
import {
  formatDurationHms,
  type ViolationTypeSummary,
} from "@/lib/fleet/violations-model";

type Props = {
  totalCount: number;
  totalDurationSeconds: number;
  summaries: ViolationTypeSummary[];
  selectedType: string | null;
  onSelect: (type: string) => void;
};

function gridColsClass(cardCount: number): string {
  if (cardCount <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (cardCount <= 4) return "grid-cols-2 lg:grid-cols-4";
  if (cardCount <= 6) return "grid-cols-2 md:grid-cols-3 xl:grid-cols-6";
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
}

function ValueDisplay({
  value,
  suffix,
}: {
  value: string;
  suffix?: string;
}) {
  const compact = value.length > 8;

  return (
    <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
      <span
        className={cn(
          "font-bold tabular-nums leading-none text-slate-900",
          compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-[1.75rem]"
        )}
      >
        {value}
      </span>
      {suffix && (
        <span className="text-xs font-medium text-slate-500">{suffix}</span>
      )}
    </p>
  );
}

function CardShell({
  children,
  accentColor,
  className,
}: {
  children: React.ReactNode;
  accentColor: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-[8.5rem] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm",
        className
      )}
    >
      <div className="flex flex-1 flex-col p-4">{children}</div>
      <div className="h-1 shrink-0 w-full" style={{ backgroundColor: accentColor }} />
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon,
  accentColor,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accentColor: string;
}) {
  return (
    <CardShell accentColor={accentColor}>
      <div
        className="mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accentColor}22` }}
      >
        {icon}
      </div>
      <p
        className="text-[10px] font-bold uppercase leading-snug tracking-[0.1em] text-slate-600"
        style={{ color: accentColor }}
      >
        {title}
      </p>
      <ValueDisplay value={value} suffix={detail} />
    </CardShell>
  );
}

function FilterCard({
  item,
  index,
  isSelected,
  onSelect,
}: {
  item: ViolationTypeSummary;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const accentColor = colorFromKey(item.type, index);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "h-full min-h-[8.5rem] text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isSelected && "rounded-xl ring-2 ring-offset-1"
      )}
      style={
        isSelected
          ? ({ outlineColor: accentColor } as React.CSSProperties)
          : undefined
      }
    >
      <CardShell
        accentColor={accentColor}
        className={cn(
          "h-full transition-shadow hover:shadow-md",
          isSelected ? "border-transparent" : "hover:border-slate-300"
        )}
      >
        <div
          className="mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accentColor}22` }}
        >
          <AlertTriangle
            className="h-4 w-4"
            style={{ color: accentColor }}
            strokeWidth={2.25}
          />
        </div>
        <p
          className="text-[10px] font-bold uppercase leading-snug tracking-[0.1em]"
          style={{ color: accentColor }}
        >
          {item.label}
        </p>
        <ValueDisplay value={String(item.count)} suffix="events" />
        <p className="mt-1 text-[11px] text-slate-500">
          {formatDurationHms(item.totalDurationSeconds)} total
        </p>
      </CardShell>
    </button>
  );
}

export function ViolationOverviewCards({
  totalCount,
  totalDurationSeconds,
  summaries,
  selectedType,
  onSelect,
}: Props) {
  const cardCount = 2 + summaries.length;
  const summaryAccent = colorFromKey("violations_summary");

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Violations overview · click a card to filter the table
      </p>
      <div
        className={cn(
          "grid auto-rows-fr gap-3 sm:gap-4",
          gridColsClass(cardCount)
        )}
      >
        <StatCard
          title="Total violations"
          value={String(totalCount)}
          detail="events"
          icon={
            <Layers
              className="h-4 w-4"
              style={{ color: summaryAccent }}
              strokeWidth={2.25}
            />
          }
          accentColor={summaryAccent}
        />
        <StatCard
          title="Total violation time"
          value={formatDurationHms(totalDurationSeconds)}
          detail="total time"
          icon={
            <Clock
              className="h-4 w-4"
              style={{ color: summaryAccent }}
              strokeWidth={2.25}
            />
          }
          accentColor={summaryAccent}
        />
        {summaries.map((item, index) => (
          <FilterCard
            key={item.type}
            item={item}
            index={index}
            isSelected={selectedType === item.type}
            onSelect={() => onSelect(item.type)}
          />
        ))}
      </div>
    </div>
  );
}

export { violationTypeColor } from "@/lib/fleet/violations-model";
