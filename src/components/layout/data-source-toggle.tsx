"use client";

import type { FleetDataSource } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  value: FleetDataSource;
  onChange: (source: FleetDataSource) => void;
  className?: string;
};

const OPTIONS: { id: FleetDataSource; label: string }[] = [
  { id: "google_sheets", label: "Google Sheets" },
  { id: "wialon", label: "Wialon API" },
];

export function DataSourceToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-slate-200/80 bg-white/90 p-0.5 shadow-sm",
        className
      )}
      role="group"
      aria-label="Data source"
    >
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-[#0f172a] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
