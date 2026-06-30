"use client";

import { format } from "date-fns";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheftFilter } from "@/context/theft-filter";
import { Badge } from "@/components/ui/badge";
import {
  connectivityBandBadgeVariant,
  connectivityBandLabel,
} from "@/lib/fleet/connectivity";
import { type VehicleTypeFilter } from "@/lib/fleet/theft-filters";
import { buildUnitCategoryMaps } from "@/lib/fleet/unit-category-maps";
import { cn } from "@/lib/utils";
import type { FleetSummary, FleetUnitRow } from "@/lib/types";

const PAGE_SIZE = 10;

type FleetFilterContextValue = {
  from: string;
  to: string;
  fleet: FleetSummary;
  selectedUnitId: string | null;
  selectedUnit: FleetUnitRow | null;
  selectUnit: (unitId: string) => void;
  clearVehicleSelection: () => void;
  vehicleType: VehicleTypeFilter;
  theftType: ReturnType<typeof useTheftFilter>["theftType"];
  displayedUnits: FleetUnitRow[];
  unitCategoryById: Map<string, FleetUnitRow["categoryKey"]>;
  hasActiveFilters: boolean;
};

const FleetFilterContext = createContext<FleetFilterContextValue | null>(null);

export function useFleetIntelligenceFilters() {
  const ctx = useContext(FleetFilterContext);
  if (!ctx) {
    throw new Error(
      "useFleetIntelligenceFilters must be used within FleetIntelligenceRoot"
    );
  }
  return ctx;
}

type RootProps = {
  from: string;
  to: string;
  fleet: FleetSummary | undefined;
  children: ReactNode;
};

export function FleetIntelligenceRoot({ from, to, fleet, children }: RootProps) {
  const { theftType } = useTheftFilter();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const vehicleType: VehicleTypeFilter = "all";

  const emptyFleet: FleetSummary = {
    units: [],
    summary: {
      total: 0,
      byCategory: {},
      updating: 0,
      nonUpdating: 0,
      active: 0,
      inactive: 0,
      maintenance: 0,
    },
  };

  const resolvedFleet = fleet ?? emptyFleet;

  const unitCategoryById = useMemo(() => {
    return buildUnitCategoryMaps(
      resolvedFleet.units.map((unit) => ({
        id: unit.id,
        categoryKey: unit.categoryKey,
        name: unit.name,
        plateNumber: unit.plateNumber,
      }))
    ).unitCategoryById;
  }, [resolvedFleet.units]);

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return resolvedFleet.units.find((u) => u.id === selectedUnitId) ?? null;
  }, [resolvedFleet.units, selectedUnitId]);

  const selectUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
  };

  const clearVehicleSelection = () => {
    setSelectedUnitId(null);
  };

  const displayedUnits = useMemo(() => {
    if (selectedUnitId) {
      const unit = resolvedFleet.units.find((u) => u.id === selectedUnitId);
      if (!unit) return [];
      if (vehicleType !== "all" && unit.categoryKey !== vehicleType) return [];
      return [unit];
    }

    let units = resolvedFleet.units;
    if (vehicleType !== "all") {
      units = units.filter((u) => u.categoryKey === vehicleType);
    }
    return units;
  }, [resolvedFleet.units, vehicleType, selectedUnitId]);

  const hasActiveFilters =
    selectedUnitId !== null || theftType !== "all";

  return (
    <FleetFilterContext.Provider
      value={{
        from,
        to,
        fleet: resolvedFleet,
        selectedUnitId,
        selectedUnit,
        selectUnit,
        clearVehicleSelection,
        vehicleType,
        theftType,
        displayedUnits,
        unitCategoryById,
        hasActiveFilters,
      }}
    >
      {children}
    </FleetFilterContext.Provider>
  );
}

export function FleetRegisterTable() {
  const { displayedUnits, selectedUnitId, selectUnit } =
    useFleetIntelligenceFilters();
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [displayedUnits]);

  const totalPages = Math.max(1, Math.ceil(displayedUnits.length / PAGE_SIZE));
  const pageUnits = displayedUnits.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <div className="dash-panel overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-dash-foreground">
            Fleet register ({displayedUnits.length} units)
          </h3>
          <p className="mt-1 text-xs text-dash-muted">
            Top {PAGE_SIZE} per page · sorted alphabetically
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="dash-icon-btn"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[5rem] text-center text-xs tabular-nums text-dash-muted">
            {displayedUnits.length === 0
              ? "0 / 0"
              : `${page + 1} / ${totalPages}`}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="dash-icon-btn"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-dash-muted">
              <th className="pb-2 pr-4 font-medium">Reg / Name</th>
              <th className="pb-2 pr-4 font-medium">Category</th>
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 pr-4 font-medium">Driver</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Connectivity</th>
              <th className="pb-2 font-medium">Last update</th>
            </tr>
          </thead>
          <tbody>
            {pageUnits.map((unit) => (
              <tr
                key={unit.id}
                onClick={() => selectUnit(unit.id)}
                className={cn(
                  "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-[#f0fdfa]/60",
                  selectedUnitId === unit.id && "bg-[#f0fdfa]"
                )}
              >
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-dash-foreground">
                    {unit.plateNumber ?? unit.name}
                  </p>
                  {unit.plateNumber && (
                    <p className="text-xs text-dash-muted">{unit.name}</p>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant="outline">{unit.category}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-dash-muted">
                  {unit.vehicleType ?? "—"}
                </td>
                <td className="py-2.5 pr-4">{unit.driverName ?? "—"}</td>
                <td className="py-2.5 pr-4">
                  <Badge
                    variant={
                      unit.status === "active"
                        ? "success"
                        : unit.status === "maintenance"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {unit.status}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant={connectivityBandBadgeVariant(unit.connectivityBand)}>
                    {connectivityBandLabel(unit.connectivityBand)}
                  </Badge>
                </td>
                <td className="py-2.5 text-dash-muted">
                  {unit.lastMessageAt
                    ? format(new Date(unit.lastMessageAt), "dd MMM HH:mm")
                    : "—"}
                </td>
              </tr>
            ))}
            {pageUnits.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className={cn("py-12 text-center text-sm text-dash-muted")}
                >
                  No units match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
