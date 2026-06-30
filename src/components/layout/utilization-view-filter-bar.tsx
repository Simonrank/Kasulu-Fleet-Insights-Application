"use client";

import { Filter } from "lucide-react";
import { useUtilizationViewFilter } from "@/context/utilization-view-filter";
import type { UtilizationViewFilter } from "@/context/utilization-view-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: UtilizationViewFilter; label: string }[] = [
  { value: "all", label: "All units" },
  { value: "top", label: "Top utilized" },
  { value: "underutilized", label: "Underutilized" },
];

export function UtilizationViewFilterBar() {
  const { view, setView } = useUtilizationViewFilter();

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden />
      <Select
        value={view}
        onValueChange={(v) => setView(v as UtilizationViewFilter)}
      >
        <SelectTrigger className="h-9 min-w-[11rem] rounded-lg border-2 border-[#0d9488] bg-white px-3 text-sm font-medium text-slate-800 shadow-sm">
          <SelectValue placeholder="All units" />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
