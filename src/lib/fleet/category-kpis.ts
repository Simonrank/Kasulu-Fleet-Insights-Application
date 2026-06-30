import { tallyConnectivityFromLastMessages } from "@/lib/fleet/connectivity";
import { aggregateFuelFleetRows } from "@/lib/fleet/fleet-metrics-aggregation";
import { matchesCategoryFilter, type VehicleTypeFilter } from "@/lib/fleet/theft-filters";
import type {
  FleetUnitRow,
  FuelFleetRow,
  FuelTheftDetail,
  FuelTheftsResponse,
  KpiSummary,
  SpeedViolationsSummary,
} from "@/lib/types";
import { normalizeAssetName } from "@/lib/fleet/asset-names";

export type CategoryMetricsSummary = {
  category: string;
  unitCount: number;
  distanceKm: number;
  engineHours: number;
  fuelConsumedLiters: number;
  consumptionKmPerLiter: number;
  consumptionLitersPerHour: number;
  directTheftLiters: number;
  returnPipeTheftLiters: number;
  totalTheftLiters: number;
  directTheftCount: number;
  returnPipeTheftCount: number;
};

export function filterEventsByCategory(
  events: FuelTheftDetail[],
  category: string,
  unitCategoryById: Map<string, string | null>,
  unitCategoryByName: Map<string, string | null>
): FuelTheftDetail[] {
  return events.filter((event) => {
    const byId = unitCategoryById.get(event.unitId);
    if (matchesCategoryFilter(byId, category)) return true;
    const byName = unitCategoryByName.get(normalizeAssetName(event.unitName));
    return matchesCategoryFilter(byName, category);
  });
}

export function computeCategoryBreakdown(
  fleetTable: FuelFleetRow[],
  events: FuelTheftDetail[],
  categories: string[],
  unitCategoryById: Map<string, string | null>,
  unitCategoryByName: Map<string, string | null>
): CategoryMetricsSummary[] {
  return categories.map((category) => {
    const rows = fleetTable.filter((row) =>
      matchesCategoryFilter(
        unitCategoryById.get(row.unitId) ?? row.category,
        category
      )
    );
    const categoryEvents = filterEventsByCategory(
      events,
      category,
      unitCategoryById,
      unitCategoryByName
    );
    const agg = aggregateFuelFleetRows(rows, categoryEvents);
    return {
      category,
      unitCount: rows.length,
      ...agg,
    };
  });
}

export function aggregateFuelOverview(
  rows: FuelFleetRow[],
  events: FuelTheftDetail[],
  totalFleet?: number
): FuelTheftsResponse["overview"] {
  const agg = aggregateFuelFleetRows(rows, events);
  const directEvents = events.filter((event) => event.theftType === "direct");
  const returnPipeEvents = events.filter(
    (event) => event.theftType === "return_pipe"
  );

  return {
    totalFleet: totalFleet ?? rows.length,
    distanceKm: agg.distanceKm,
    kmPerLiter: agg.consumptionKmPerLiter,
    litersPerHour: agg.consumptionLitersPerHour,
    hoursPerLiter:
      agg.consumptionKmPerLiter > 0 ? 1 / agg.consumptionKmPerLiter : 0,
    directTheft: {
      count: agg.directTheftCount,
      volumeLiters: agg.directTheftLiters,
    },
    returnPipeTheft: {
      count: agg.returnPipeTheftCount,
      volumeLiters: agg.returnPipeTheftLiters,
    },
    fuelFillings: { count: 0, volumeLiters: 0 },
    fuelDrains: {
      count: directEvents.length + returnPipeEvents.length,
      volumeLiters: agg.totalTheftLiters,
    },
    fuelConsumedLiters: agg.fuelConsumedLiters,
    engineHours: agg.engineHours,
  };
}

export function filterSpeedViolationsSummary(
  summary: SpeedViolationsSummary,
  matchesUnit: (unitId?: string | null, unitName?: string | null) => boolean
): SpeedViolationsSummary {
  const byUnit = summary.byUnit.filter((unit) =>
    matchesUnit(null, unit.unitName)
  );
  const events = summary.events.filter((event) =>
    matchesUnit(null, event.unitName)
  );

  return {
    ...summary,
    totalEvents: events.length,
    totalMileageKm: events.reduce((sum, event) => sum + event.mileageKm, 0),
    byUnit,
    events,
  };
}

export function filterFleetTableByCategory(
  rows: FuelFleetRow[],
  filter: VehicleTypeFilter,
  unitCategoryById: Map<string, string | null>
): FuelFleetRow[] {
  if (filter === "all") return rows;
  return rows.filter((row) =>
    matchesCategoryFilter(unitCategoryById.get(row.unitId) ?? row.category, filter)
  );
}

export function filterFleetUnitsByCategory(
  units: FleetUnitRow[],
  filter: VehicleTypeFilter
): FleetUnitRow[] {
  if (filter === "all") return units;
  return units.filter((unit) => unit.categoryKey === filter);
}

/** Re-aggregate dashboard KPIs for a single fleet category. */
export function aggregateKpisForCategory(
  base: KpiSummary,
  rows: FuelFleetRow[],
  units: FleetUnitRow[],
  events: FuelTheftDetail[]
): KpiSummary {
  const agg = aggregateFuelFleetRows(rows, events);

  const updatingUnits = units.filter((unit) => unit.isUpdating).length;
  const connectivityBands = tallyConnectivityFromLastMessages(
    units.map((unit) =>
      unit.lastMessageAt ? new Date(unit.lastMessageAt) : null
    )
  );

  return {
    ...base,
    totalDistanceKm: agg.distanceKm,
    totalEngineHours: agg.engineHours,
    consumptionKmPerLiter: agg.consumptionKmPerLiter,
    consumptionLitersPerHour: agg.consumptionLitersPerHour,
    updatingUnits,
    nonUpdatingUnits: units.length - updatingUnits,
    totalUnits: units.length,
    connectivityBands,
    directThefts: {
      count: agg.directTheftCount,
      volumeLiters: agg.directTheftLiters,
    },
    returnPipeThefts: {
      count: agg.returnPipeTheftCount,
      volumeLiters: agg.returnPipeTheftLiters,
    },
  };
}
