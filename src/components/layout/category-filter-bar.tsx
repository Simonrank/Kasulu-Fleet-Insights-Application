"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFleetCategoryFilter } from "@/context/fleet-category-filter";
import type { VehicleTypeFilter } from "@/lib/fleet/theft-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  className?: string;
  compact?: boolean;
};

export function CategoryFilterBar({ className, compact }: Props) {
  const { categoryFilter, setCategoryFilter, categoryOptions } =
    useFleetCategoryFilter();

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Filter className="h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden />
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as VehicleTypeFilter)}
        >
          <SelectTrigger className="h-9 min-w-[11rem] rounded-lg border-2 border-[#0d9488] bg-white px-3 text-sm font-medium text-slate-800 shadow-sm">
            <SelectValue placeholder="All fleet" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const pills = categoryOptions.filter((o) => o.value !== "all");

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label="Fleet category filter"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Category
      </span>
      <button
        type="button"
        onClick={() => setCategoryFilter("all")}
        className={cn(
          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          categoryFilter === "all"
            ? "border-[#0d9488] bg-[#0d9488] text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-[#99f6e4] hover:bg-[#f0fdfa]"
        )}
      >
        All fleet
      </button>
      {pills.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setCategoryFilter(option.value as VehicleTypeFilter)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            categoryFilter === option.value
              ? "border-[#0d9488] bg-[#0d9488] text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-[#99f6e4] hover:bg-[#f0fdfa]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
