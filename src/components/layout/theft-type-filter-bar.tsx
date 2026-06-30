"use client";

import { Filter } from "lucide-react";
import { useTheftFilter } from "@/context/theft-filter";
import type { TheftFilter } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: TheftFilter; label: string }[] = [
  { value: "all", label: "All theft types" },
  { value: "direct", label: "Direct thefts only" },
  { value: "return_pipe", label: "Return pipe only" },
];

export function TheftTypeFilterBar() {
  const { theftType, setTheftType } = useTheftFilter();

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden />
      <Select
        value={theftType}
        onValueChange={(v) => setTheftType(v as TheftFilter)}
      >
        <SelectTrigger className="h-9 min-w-[11rem] rounded-lg border-2 border-[#0d9488] bg-white px-3 text-sm font-medium text-slate-800 shadow-sm">
          <SelectValue placeholder="All theft types" />
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
