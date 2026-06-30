"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildUnitCategoryMaps } from "@/lib/fleet/unit-category-maps";
import {
  buildCategoryFilterOptions,
  type VehicleTypeFilter,
} from "@/lib/fleet/theft-filters";
import { useDashboard } from "@/hooks/use-fleet-data";
import type { DashboardBundle } from "@/lib/types";

type FleetCategoryFilterContextValue = {
  categoryFilter: VehicleTypeFilter;
  setCategoryFilter: (value: VehicleTypeFilter) => void;
  categoryOptions: { value: VehicleTypeFilter; label: string }[];
  unitCategoryById: Map<string, string | null>;
  unitCategoryByName: Map<string, string | null>;
  isActive: boolean;
};

const FleetCategoryFilterContext =
  createContext<FleetCategoryFilterContextValue | null>(null);

type ProviderProps = {
  from: string;
  to: string;
  children: ReactNode;
};

function collectCategoryLabels(dashboard: DashboardBundle | undefined): string[] {
  const labels = new Set<string>();

  for (const unit of dashboard?.fleet.units ?? []) {
    const label = unit.categoryKey ?? unit.category;
    if (label && label !== "—") labels.add(label);
  }

  for (const row of dashboard?.thefts.fleetTable ?? []) {
    if (row.category && row.category !== "—") labels.add(row.category);
  }

  for (const row of dashboard?.thefts.theftByCategory ?? []) {
    const label = row.categoryKey || row.category;
    if (label && label !== "—") labels.add(label);
  }

  for (const [category] of Object.entries(
    dashboard?.fleet.summary.byCategory ?? {}
  )) {
    if (category && category !== "—") labels.add(category);
  }

  return [...labels].sort((a, b) => a.localeCompare(b));
}

export function FleetCategoryFilterProvider({
  from,
  to,
  children,
}: ProviderProps) {
  const [categoryFilter, setCategoryFilter] =
    useState<VehicleTypeFilter>("all");
  const { data: dashboard } = useDashboard(from, to);

  const fleetUnits = dashboard?.fleet.units ?? [];

  const { unitCategoryById, unitCategoryByName } = useMemo(
    () =>
      buildUnitCategoryMaps(
        fleetUnits.map((unit) => ({
          id: unit.id,
          categoryKey: unit.categoryKey,
          name: unit.name,
          plateNumber: unit.plateNumber,
        }))
      ),
    [fleetUnits]
  );

  const categoryOptions = useMemo(() => {
    const labels = collectCategoryLabels(dashboard);
    if (labels.length > 0) {
      return [
        { value: "all" as const, label: "All fleet" },
        ...labels.map((label) => ({ value: label, label })),
      ];
    }
    if (fleetUnits.length > 0) {
      return buildCategoryFilterOptions(fleetUnits);
    }
    return [{ value: "all" as const, label: "All fleet" }];
  }, [dashboard, fleetUnits]);

  const value = useMemo(
    () => ({
      categoryFilter,
      setCategoryFilter,
      categoryOptions,
      unitCategoryById,
      unitCategoryByName,
      isActive: categoryFilter !== "all",
    }),
    [
      categoryFilter,
      categoryOptions,
      unitCategoryById,
      unitCategoryByName,
    ]
  );

  return (
    <FleetCategoryFilterContext.Provider value={value}>
      {children}
    </FleetCategoryFilterContext.Provider>
  );
}

export function useFleetCategoryFilter(): FleetCategoryFilterContextValue {
  const ctx = useContext(FleetCategoryFilterContext);
  if (!ctx) {
    throw new Error(
      "useFleetCategoryFilter must be used within FleetCategoryFilterProvider"
    );
  }
  return ctx;
}

/** Safe when provider is optional (e.g. tests). */
export function useFleetCategoryFilterOptional():
  | FleetCategoryFilterContextValue
  | null {
  return useContext(FleetCategoryFilterContext);
}
