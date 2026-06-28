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
import { TabWorkspace } from "@/components/dashboard/tab-workspace";
import { VehicleSearch } from "@/components/dashboard/vehicle-search";
import { Badge } from "@/components/ui/badge";
import {
  DURATION_BANDS,
  buildCategoryFilterOptions,
  type VehicleTypeFilter,
} from "@/lib/fleet/theft-filters";
import { cn } from "@/lib/utils";
import type { DurationBand, FleetSummary, FleetUnitRow, TheftFilter } from "@/lib/types";

const PAGE_SIZE = 10;

type FleetFilterContextValue = {
  from: string;
  to: string;
  fleet: FleetSummary;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedUnitId: string | null;
  selectedUnit: FleetUnitRow | null;
  selectUnit: (unitId: string) => void;
  clearVehicleSelection: () => void;
  vehicleType: VehicleTypeFilter;
  setVehicleType: (value: VehicleTypeFilter) => void;
  theftType: TheftFilter;
  setTheftType: (value: TheftFilter) => void;
  durationBand: DurationBand;
  setDurationBand: (value: DurationBand) => void;
  displayedUnits: FleetUnitRow[];
  unitCategoryById: Map<string, FleetUnitRow["categoryKey"]>;
  categoryFilterOptions: { value: VehicleTypeFilter; label: string }[];
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleTypeFilter>("all");
  const [theftType, setTheftType] = useState<TheftFilter>("all");
  const [durationBand, setDurationBand] = useState<DurationBand>("all");

  const categoryFilterOptions = useMemo(
    () =>
      fleet
        ? buildCategoryFilterOptions(fleet.units)
        : [{ value: "all" as const, label: "All categories" }],
    [fleet]
  );

  const unitCategoryById = useMemo(() => {
    if (!fleet) return new Map<string, FleetUnitRow["categoryKey"]>();
    return new Map(fleet.units.map((u) => [u.id, u.categoryKey]));
  }, [fleet]);

  const selectedUnit = useMemo(() => {
    if (!fleet || !selectedUnitId) return null;
    return fleet.units.find((u) => u.id === selectedUnitId) ?? null;
  }, [fleet, selectedUnitId]);

  const selectUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
    setSearchQuery("");
  };

  const clearVehicleSelection = () => {
    setSelectedUnitId(null);
    setSearchQuery("");
  };

  const displayedUnits = useMemo(() => {
    if (!fleet) return [];

    if (selectedUnitId) {
      const unit = fleet.units.find((u) => u.id === selectedUnitId);
      if (!unit) return [];
      if (vehicleType !== "all" && unit.categoryKey !== vehicleType) return [];
      return [unit];
    }

    let units = fleet.units;
    if (vehicleType !== "all") {
      units = units.filter((u) => u.categoryKey === vehicleType);
    }
    return units;
  }, [fleet, vehicleType, selectedUnitId]);

  const hasActiveFilters =
    selectedUnitId !== null ||
    vehicleType !== "all" ||
    theftType !== "all" ||
    durationBand !== "all";

  if (!fleet) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-200/60" />;
  }

  return (
    <FleetFilterContext.Provider
      value={{
        from,
        to,
        fleet,
        searchQuery,
        setSearchQuery,
        selectedUnitId,
        selectedUnit,
        selectUnit,
        clearVehicleSelection,
        vehicleType,
        setVehicleType,
        theftType,
        setTheftType,
        durationBand,
        setDurationBand,
        displayedUnits,
        unitCategoryById,
        categoryFilterOptions,
        hasActiveFilters,
      }}
    >
      {children}
    </FleetFilterContext.Provider>
  );
}

export function FleetIntelligenceWorkspace() {
  const {
    from,
    to,
    vehicleType,
    setVehicleType,
    theftType,
    setTheftType,
    durationBand,
    setDurationBand,
    displayedUnits,
    fleet,
    hasActiveFilters,
    selectedUnit,
    categoryFilterOptions,
  } = useFleetIntelligenceFilters();

  const selectedLabel =
    selectedUnit?.plateNumber ??
    selectedUnit?.name.split("—")[0]?.trim() ??
    selectedUnit?.name;

  return (
    <TabWorkspace
      title="Kasulu fleet intelligence"
      from={from}
      to={to}
      searchSlot={<VehicleSearch />}
      filters={[
        {
          id: "vehicle-type",
          label: "Category",
          value: vehicleType,
          onChange: (v) => setVehicleType(v as VehicleTypeFilter),
          placeholder: "All categories",
          options: categoryFilterOptions.map((o) => ({
            value: o.value,
            label: o.label,
          })),
        },
        {
          id: "theft-type",
          label: "Theft type",
          value: theftType,
          onChange: (v) => setTheftType(v as TheftFilter),
          placeholder: "All theft types",
          options: [
            { value: "all", label: "All theft types" },
            { value: "direct", label: "Direct thefts only" },
            { value: "return_pipe", label: "Return pipe only" },
          ],
        },
        {
          id: "duration-band",
          label: "Duration band",
          value: durationBand,
          onChange: (v) => setDurationBand(v as DurationBand),
          placeholder: "All duration bands",
          options: DURATION_BANDS.map((b) => ({
            value: b.value,
            label: b.label,
          })),
        },
      ]}
      resultSummary={
        selectedUnit
          ? `Showing ${selectedLabel} · fleet register filtered to 1 unit`
          : hasActiveFilters
            ? `Fleet register: ${displayedUnits.length} of ${fleet.units.length} units match`
            : undefined
      }
    />
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
                  <Badge variant={unit.isUpdating ? "success" : "destructive"}>
                    {unit.isUpdating ? "Updating" : "Non-updating"}
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
