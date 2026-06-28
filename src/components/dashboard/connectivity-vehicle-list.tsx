"use client";

import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import type { ConnectivityFilter, FleetUnitRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  units: FleetUnitRow[];
  filter: ConnectivityFilter;
  onSelectUnit?: (unitId: string) => void;
  compact?: boolean;
};

export function ConnectivityVehicleList({
  units,
  filter,
  onSelectUnit,
  compact = false,
}: Props) {
  const filtered =
    filter === "updating"
      ? units.filter((u) => u.isUpdating)
      : filter === "non_updating"
        ? units.filter((u) => !u.isUpdating)
        : units;

  const title =
    filter === "updating"
      ? "Updating vehicles"
      : filter === "non_updating"
        ? "Non-updating vehicles"
        : "All vehicles";

  if (filtered.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground",
          compact && "py-4 text-xs"
        )}
      >
        No {filter === "updating" ? "updating" : "non-updating"} vehicles
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide text-muted-foreground",
          compact && "text-[10px]"
        )}
      >
        {title} ({filtered.length})
      </p>
      <ul className="space-y-1.5">
        {filtered.map((unit) => {
          const content = (
            <>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {unit.plateNumber ?? unit.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {unit.plateNumber ? unit.name : unit.category}
                  {unit.driverName ? ` · ${unit.driverName}` : ""}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                {unit.lastMessageAt && (
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    {format(new Date(unit.lastMessageAt), "dd MMM HH:mm")}
                  </span>
                )}
                {onSelectUnit && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#0d9488]" />
                )}
              </div>
            </>
          );

          return (
            <li key={unit.id}>
              {onSelectUnit ? (
                <button
                  type="button"
                  onClick={() => onSelectUnit(unit.id)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[#0d9488] hover:bg-[#f0fdfa]",
                    compact && "py-2"
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5",
                    compact && "py-2"
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
