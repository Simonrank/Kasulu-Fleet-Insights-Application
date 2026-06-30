import type { FuelFleetRow, FuelTheftDetail, UtilizationUnitRow } from "@/lib/types";
import { averageSheetMetric } from "@/lib/utils";

export type FuelFleetAggregate = {
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

export type UtilizationFleetTotals = {
  totalDistanceKm: number;
  totalEngineHours: number;
  totalProductiveHours: number;
  totalIdleHours: number;
  avgKmPerEngineHour: number;
  unitCount: number;
};

type UtilizationUnitMetrics = Pick<
  UtilizationUnitRow,
  "distanceKm" | "engineHours" | "productiveHours" | "idleHours"
>;

/** Single source for fuel-row + theft-event rollups (dashboard category filter, overview). */
export function aggregateFuelFleetRows(
  rows: FuelFleetRow[],
  events: FuelTheftDetail[]
): FuelFleetAggregate {
  const totalDistanceKm = rows.reduce((sum, row) => sum + row.distanceKm, 0);
  const totalEngineHours = rows.reduce((sum, row) => sum + row.engineHours, 0);
  const fuelConsumedLiters = rows.reduce(
    (sum, row) => sum + row.fuelConsumedLiters,
    0
  );

  const kmPerLiterSamples = rows
    .map((row) => row.kmPerLiter)
    .filter((value) => value > 0);
  const litersPerHourSamples = rows
    .map((row) => row.litersPerHour)
    .filter((value) => value > 0);

  const directEvents = events.filter((event) => event.theftType === "direct");
  const returnPipeEvents = events.filter(
    (event) => event.theftType === "return_pipe"
  );

  const directTheftLiters = directEvents.reduce(
    (sum, event) => sum + event.volumeLiters,
    0
  );
  const returnPipeTheftLiters = returnPipeEvents.reduce(
    (sum, event) => sum + event.volumeLiters,
    0
  );

  return {
    distanceKm: totalDistanceKm,
    engineHours: totalEngineHours,
    fuelConsumedLiters,
    consumptionKmPerLiter:
      averageSheetMetric(kmPerLiterSamples) ||
      (fuelConsumedLiters > 0 ? totalDistanceKm / fuelConsumedLiters : 0),
    consumptionLitersPerHour:
      averageSheetMetric(litersPerHourSamples) ||
      (totalEngineHours > 0 ? fuelConsumedLiters / totalEngineHours : 0),
    directTheftLiters,
    returnPipeTheftLiters,
    totalTheftLiters: directTheftLiters + returnPipeTheftLiters,
    directTheftCount: directEvents.length,
    returnPipeTheftCount: returnPipeEvents.length,
  };
}

/** Roll up utilization unit rows into fleet-level totals. */
export function aggregateUtilizationFleet(
  units: UtilizationUnitMetrics[]
): UtilizationFleetTotals {
  const totalDistanceKm = units.reduce((sum, unit) => sum + unit.distanceKm, 0);
  const totalEngineHours = units.reduce(
    (sum, unit) => sum + unit.engineHours,
    0
  );
  const totalIdleHours = units.reduce((sum, unit) => sum + unit.idleHours, 0);
  const totalProductiveHours = units.reduce(
    (sum, unit) => sum + unit.productiveHours,
    0
  );

  return {
    totalDistanceKm,
    totalEngineHours,
    totalProductiveHours,
    totalIdleHours,
    avgKmPerEngineHour:
      totalEngineHours > 0 ? totalDistanceKm / totalEngineHours : 0,
    unitCount: units.length,
  };
}
