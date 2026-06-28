import { startOfDay } from "date-fns";
import {
  cell,
  cellNumber,
  headerIndexMap,
  parseSheetDate,
  resolveColumn,
  type ParsedKasuluFleetRow,
} from "@/lib/google-sheets/parse";
import { parseWialonDurationHours } from "@/lib/wialon/normalize";
import type { WialonReportCell } from "@/lib/wialon/report-types";

export function wialonCellValue(cellValue: WialonReportCell): string {
  if (cellValue == null) return "";
  if (typeof cellValue === "string") return cellValue.trim();
  if (typeof cellValue === "object" && "t" in cellValue) {
    return String(cellValue.t ?? "").trim();
  }
  return String(cellValue).trim();
}

export function wialonRowToStrings(row: { c?: WialonReportCell[] }): string[] {
  return (row.c ?? []).map(wialonCellValue);
}

/** Map a Wialon report table row to the same shape as the Kasulu Google Sheet. */
export function parseWialonFleetReportRow(
  headers: string[],
  row: string[],
  reportDate: Date
): ParsedKasuluFleetRow | null {
  const map = headerIndexMap(headers);

  const machineId = cell(
    row,
    resolveColumn(map, [
      "machine_id",
      "machine id",
      "unit",
      "unit_name",
      "name",
      "object",
      "registration",
    ])
  );

  if (!machineId) return null;

  const parsedDate =
    parseSheetDate(cell(row, resolveColumn(map, ["date", "day", "time"]))) ??
    startOfDay(reportDate);

  const comment = cell(
    row,
    resolveColumn(map, ["comment", "notes", "status", "connectivity"])
  );

  const lastMessageRaw = cell(
    row,
    resolveColumn(map, [
      "last_message",
      "last message",
      "last coordinates time",
      "time received",
    ])
  );

  const distanceKm = cellNumber(
    row,
    resolveColumn(map, ["mileage", "distance_km", "distance", "mileage (km)"])
  );
  const engineHours = cellNumber(
    row,
    resolveColumn(map, ["engine_hours", "engine hours", "engine hrs"])
  );
  const initialFuelLevel = cellNumber(
    row,
    resolveColumn(map, ["initial_fuel_level", "initial fuel level", "initial fuel"])
  );
  const fuelFilledLiters = cellNumber(
    row,
    resolveColumn(map, ["top_up", "top up", "fuel filled", "fillings"])
  );
  const finalFuelLevel = cellNumber(
    row,
    resolveColumn(map, ["final_fuel_level", "final fuel level", "final fuel"])
  );
  const fuelConsumedLiters = cellNumber(
    row,
    resolveColumn(map, ["fuel_consumed", "fuel consumed", "consumed"])
  );
  const kmPerLiter = cellNumber(
    row,
    resolveColumn(map, [
      "consumption_(km/l)",
      "consumption (km/l)",
      "km/l",
      "consumption km/l",
    ])
  );
  const litersPerHour = cellNumber(
    row,
    resolveColumn(map, [
      "consumption_(ltrs/hr)",
      "consumption (ltrs/hr)",
      "l/hr",
      "l/h",
      "consumption l/hr",
    ])
  );
  const fuelTheftLiters = cellNumber(
    row,
    resolveColumn(map, [
      "fuel_theft",
      "fuel theft",
      "theft",
      "fuel drain",
      "drain",
    ])
  );

  if (
    !distanceKm &&
    !engineHours &&
    !fuelConsumedLiters &&
    !fuelTheftLiters &&
    !fuelFilledLiters
  ) {
    return null;
  }

  return {
    machineId,
    lastMessageAt: parseSheetDate(lastMessageRaw),
    date: parsedDate,
    distanceKm,
    engineHours,
    initialFuelLevel,
    fuelFilledLiters,
    finalFuelLevel,
    fuelConsumedLiters,
    kmPerLiter,
    litersPerHour,
    fuelTheftLiters,
    comment,
  };
}

export type ParsedUnitLatestRow = {
  machineId: string;
  reg: string;
  lastMessageAt: Date | null;
  locationLabel: string | null;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  distanceKm: number;
};

function parseCoordinatePair(value: string): { lat: number; lon: number } | null {
  const match = value.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** Wialon "Unit latest data" report table row. */
export function parseWialonUnitLatestRow(
  headers: string[],
  row: string[]
): ParsedUnitLatestRow | null {
  const map = headerIndexMap(headers);

  const machineId = cell(
    row,
    resolveColumn(map, [
      "unit",
      "unit_name",
      "name",
      "object",
      "registration",
      "machine_id",
      "machine id",
      "reg_no",
      "reg no",
    ])
  );

  if (!machineId) return null;

  const reg =
    cell(row, resolveColumn(map, ["reg_no", "reg no", "registration", "plate"])) ||
    machineId.split("—")[0]?.trim() ||
    machineId;

  const lastMessageRaw = cell(
    row,
    resolveColumn(map, [
      "last_message",
      "last message",
      "message time",
      "time",
      "last coordinates time",
    ])
  );

  const locationRaw = cell(
    row,
    resolveColumn(map, [
      "current_location",
      "current location",
      "location",
      "address",
      "coordinates",
      "position",
    ])
  );

  const coords = parseCoordinatePair(locationRaw);
  const speedRaw = cell(row, resolveColumn(map, ["speed", "speed (km/h)"]));
  const speedKmh = cellNumber(row, resolveColumn(map, ["speed", "speed (km/h)"]));
  const parsedSpeed =
    speedKmh > 0
      ? speedKmh
      : (() => {
          const match = speedRaw.match(/([\d.]+)/);
          return match ? Number(match[1]) : 0;
        })();

  const distanceKm = cellNumber(
    row,
    resolveColumn(map, [
      "distance_(km)",
      "distance (km)",
      "mileage",
      "distance",
      "mileage (km)",
    ])
  );

  const locationLabel =
    locationRaw && !coords
      ? locationRaw
      : coords
        ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
        : null;

  return {
    machineId,
    reg,
    lastMessageAt: parseSheetDate(lastMessageRaw),
    locationLabel,
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    speedKmh: parsedSpeed > 0 ? parsedSpeed : null,
    distanceKm,
  };
}

export type ParsedSpeedingRow = {
  unitName: string;
  durationMinutes: number;
  speedKmh: number;
  speedLimitKmh: number;
  mileageKm: number;
  occurredAt: Date | null;
};

function parseSpeedValue(raw: string, numeric: number): number {
  if (numeric > 0) return numeric;
  const match = raw.match(/([\d.]+)/);
  return match ? Number(match[1]) : 0;
}

/** Wialon "Speedings" report table row. */
export function parseWialonSpeedingRow(
  headers: string[],
  row: string[],
  reportDate?: Date
): ParsedSpeedingRow | null {
  const map = headerIndexMap(headers);

  const unitName = cell(
    row,
    resolveColumn(map, [
      "grouping",
      "unit",
      "unit_name",
      "name",
      "object",
      "registration",
      "machine_id",
    ])
  );

  if (!unitName) return null;

  const durationRaw = cell(row, resolveColumn(map, ["duration"]));
  const durationMinutes = Math.round(parseWialonDurationHours(durationRaw) * 60);

  const speedRaw = cell(row, resolveColumn(map, ["speed", "speed (km/h)"]));
  const speedKmh = parseSpeedValue(
    speedRaw,
    cellNumber(row, resolveColumn(map, ["speed", "speed (km/h)"]))
  );

  const limitRaw = cell(
    row,
    resolveColumn(map, ["speed_limit", "speed limit", "limit"])
  );
  const speedLimitKmh = parseSpeedValue(
    limitRaw,
    cellNumber(row, resolveColumn(map, ["speed_limit", "speed limit", "limit"]))
  );

  const mileageKm = cellNumber(
    row,
    resolveColumn(map, ["mileage", "distance (km)", "distance_km", "distance"])
  );

  if (!speedKmh && !durationMinutes && !mileageKm) return null;

  return {
    unitName,
    durationMinutes,
    speedKmh,
    speedLimitKmh,
    mileageKm,
    occurredAt: reportDate ?? null,
  };
}
