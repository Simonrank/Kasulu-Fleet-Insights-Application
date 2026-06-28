"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useFleetIntelligenceFilters } from "@/components/dashboard/fleet-register-panel";
import { cn } from "@/lib/utils";
import type { FleetUnitRow } from "@/lib/types";

function unitLabel(unit: FleetUnitRow): string {
  return unit.plateNumber ?? unit.name.split("—")[0]?.trim() ?? unit.name;
}

function unitMatchesQuery(unit: FleetUnitRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [unit.plateNumber, unit.name, unit.driverName, unit.vehicleType, unit.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function VehicleSearch() {
  const {
    fleet,
    vehicleType,
    searchQuery,
    setSearchQuery,
    selectedUnit,
    selectUnit,
    clearVehicleSelection,
  } = useFleetIntelligenceFilters();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const pool = useMemo(() => {
    let units = fleet.units;
    if (vehicleType !== "all") {
      units = units.filter((u) => u.categoryKey === vehicleType);
    }
    return units;
  }, [fleet.units, vehicleType]);

  const suggestions = useMemo(() => {
    if (selectedUnit) return [];
    const q = searchQuery.trim();
    if (q.length < 1) return [];
    return pool.filter((u) => unitMatchesQuery(u, q)).slice(0, 10);
  }, [pool, searchQuery, selectedUnit]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Search className="h-4 w-4" />
        Search vehicle
      </label>
      <div className="relative">
        <input
          type="search"
          value={selectedUnit ? unitLabel(selectedUnit) : searchQuery}
          onChange={(e) => {
            if (selectedUnit) clearVehicleSelection();
            setSearchQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type registration or machine name…"
          className={cn(
            "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
            selectedUnit && "pr-10"
          )}
          readOnly={!!selectedUnit}
        />
        {selectedUnit && (
          <button
            type="button"
            onClick={clearVehicleSelection}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear selected vehicle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !selectedUnit && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((unit) => (
            <li key={unit.id} role="option">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#f0fdfa]"
                onClick={() => {
                  selectUnit(unit.id);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-foreground">
                  {unitLabel(unit)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {unit.category}
                  {unit.driverName ? ` · ${unit.driverName}` : ""}
                  {unit.isUpdating ? " · Updating" : " · Non-updating"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !selectedUnit && searchQuery.trim().length > 0 && suggestions.length === 0 && (
        <p className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover px-4 py-3 text-sm text-muted-foreground shadow-lg">
          No vehicles match &ldquo;{searchQuery.trim()}&rdquo;
        </p>
      )}
    </div>
  );
}
