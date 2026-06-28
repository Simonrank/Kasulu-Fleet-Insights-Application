"use client";

import { format } from "date-fns";
import { Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type WorkspaceSelectFilter = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
};

type TabWorkspaceProps = {
  title: string;
  from?: string;
  to?: string;
  periodLabel?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchSlot?: React.ReactNode;
  filters?: WorkspaceSelectFilter[];
  resultSummary?: string;
  hideSearch?: boolean;
  className?: string;
};

export function TabWorkspace({
  title,
  from,
  to,
  periodLabel,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  searchSlot,
  filters = [],
  resultSummary,
  hideSearch = false,
  className,
}: TabWorkspaceProps) {
  const subtitle =
    periodLabel ??
    (from && to
      ? `${format(new Date(from), "dd MMM")} — ${format(new Date(to), "dd MMM yyyy")}`
      : undefined);

  const columnCount = (hideSearch ? 0 : 1) + filters.length;
  const showSearch = !hideSearch && (searchSlot || onSearchChange);

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-sm",
        className
      )}
    >
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}

      <div
        className={cn(
          "mt-6 grid gap-4",
          columnCount === 1 && "grid-cols-1",
          columnCount === 2 && "md:grid-cols-2",
          columnCount === 3 && "md:grid-cols-2 lg:grid-cols-3",
          columnCount >= 4 && "md:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {showSearch &&
          (searchSlot ? (
            searchSlot
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Search className="h-4 w-4 text-[#0d9488]" />
                Search
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="dash-date-input h-11 w-full rounded-xl px-4 text-sm"
              />
            </div>
          ))}

        {filters.map((filter) => (
          <div key={filter.id} className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4 text-[#0d9488]" />
              {filter.label}
            </label>
            <Select value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger className="dash-date-input h-11 rounded-xl">
                <SelectValue placeholder={filter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {resultSummary && (
        <p className="mt-4 rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
          {resultSummary}
        </p>
      )}
    </section>
  );
}
