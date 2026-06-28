import { parseISO, isValid, parse } from "date-fns";
import { classifyTheftType } from "@/lib/wialon/normalize";
import { inferVehicleCategory } from "@/lib/fleet/categories";
import type { driverIncidents } from "@/lib/db/schema";

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function headerIndexMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header?.trim()) {
      map.set(normalizeHeader(header), index);
    }
  });
  return map;
}

export function cell(row: string[], index: number | undefined): string {
  if (index == null || index < 0) return "";
  return (row[index] ?? "").trim();
}

export function cellNumber(row: string[], index: number | undefined): number {
  const raw = cell(row, index).replace(/,/g, "");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function parseSheetDate(value: string): Date | null {
  if (!value) return null;

  const trimmed = value.trim();

  // dd/MM/yyyy or dd/MM/yyyy HH:mm:ss
  const dmy = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmy) {
    const parsed = parse(
      `${dmy[1]}/${dmy[2]}/${dmy[3]}${dmy[4] ? ` ${dmy[4]}:${dmy[5]}:${dmy[6] ?? "00"}` : ""}`,
      dmy[4] ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy",
      new Date()
    );
    if (isValid(parsed)) return parsed;
  }

  // dd.MM.yyyy HH:mm:ss
  const dot = trimmed.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/
  );
  if (dot) {
    const parsed = parse(
      `${dot[1]}.${dot[2]}.${dot[3]}${dot[4] ? ` ${dot[4]}:${dot[5]}:${dot[6]}` : ""}`,
      dot[4] ? "dd.MM.yyyy HH:mm:ss" : "dd.MM.yyyy",
      new Date()
    );
    if (isValid(parsed)) return parsed;
  }

  const iso = parseISO(trimmed);
  if (isValid(iso)) return iso;

  const parsed = new Date(trimmed);
  return isValid(parsed) ? parsed : null;
}

export function resolveColumn(
  map: Map<string, number>,
  aliases: string[]
): number | undefined {
  for (const alias of aliases) {
    const index = map.get(normalizeHeader(alias));
    if (index != null) return index;
  }
  return undefined;
}

export type ParsedUnitRow = {
  wialonId: number;
  name: string;
  plateNumber?: string;
  driverName?: string;
  vehicleType?: string;
  vehicleCategory?: string;
  status?: "active" | "inactive" | "maintenance";
};

export function parseUnitRow(
  row: string[],
  map: Map<string, number>
): ParsedUnitRow | null {
  const wialonId = cellNumber(
    row,
    resolveColumn(map, ["wialon_id", "wialon id", "unit_id", "id"])
  );
  const name = cell(
    row,
    resolveColumn(map, ["name", "unit_name", "unit name", "unit"])
  );

  if (!wialonId && !name) return null;
  if (!wialonId) return null;

  const vehicleType = cell(
    row,
    resolveColumn(map, ["vehicle_type", "vehicle type", "type"])
  );

  const explicitCategory = cell(
    row,
    resolveColumn(map, ["vehicle_category", "category"])
  );

  return {
    wialonId,
    name: name || `Unit ${wialonId}`,
    plateNumber: cell(row, resolveColumn(map, ["plate_number", "plate", "reg", "registration"])) || undefined,
    driverName: cell(row, resolveColumn(map, ["driver_name", "driver"])) || undefined,
    vehicleType: vehicleType || undefined,
    vehicleCategory:
      explicitCategory ||
      inferVehicleCategory(vehicleType, name) ||
      undefined,
    status: (cell(row, resolveColumn(map, ["status"])) as ParsedUnitRow["status"]) || "active",
  };
}

export type ParsedFuelRow = {
  externalId: string;
  unitKey: string;
  eventType: "theft" | "filling";
  volumeLiters: number;
  occurredAt: Date;
  description?: string;
  locationName?: string;
  durationMinutes?: number;
  theftType?: "direct" | "return_pipe";
};

export function parseFuelRow(
  row: string[],
  map: Map<string, number>,
  rowNumber: number
): ParsedFuelRow | null {
  const unitKey = cell(
    row,
    resolveColumn(map, [
      "unit",
      "unit_name",
      "registration",
      "plate",
      "wialon_id",
      "wialon id",
    ])
  );
  const occurredAt = parseSheetDate(
    cell(row, resolveColumn(map, ["date", "occurred_at", "occurred at", "datetime"]))
  );

  if (!unitKey || !occurredAt) return null;

  const eventTypeRaw = cell(
    row,
    resolveColumn(map, ["event_type", "event type", "type"])
  ).toLowerCase();
  const eventType: "theft" | "filling" =
    eventTypeRaw.includes("fill") || eventTypeRaw.includes("refuel")
      ? "filling"
      : "theft";

  const description = cell(row, resolveColumn(map, ["description", "notes"])) || undefined;
  const theftTypeRaw = cell(
    row,
    resolveColumn(map, ["theft_type", "theft type"])
  );

  return {
    externalId:
      cell(row, resolveColumn(map, ["event_id", "id"])) ||
      `sheet-fuel-${rowNumber}-${unitKey}-${occurredAt.toISOString()}`,
    unitKey,
    eventType,
    volumeLiters: cellNumber(
      row,
      resolveColumn(map, ["volume_liters", "volume (l)", "volume", "liters", "l"])
    ),
    occurredAt,
    description,
    locationName: cell(row, resolveColumn(map, ["location", "location_name"])) || undefined,
    durationMinutes:
      cellNumber(row, resolveColumn(map, ["duration_minutes", "duration (min)", "duration"])) ||
      undefined,
    theftType:
      eventType === "theft"
        ? theftTypeRaw === "return_pipe" || theftTypeRaw === "return pipe"
          ? "return_pipe"
          : classifyTheftType(description ?? theftTypeRaw)
        : undefined,
  };
}

export type ParsedIncidentRow = {
  externalId: string;
  unitKey: string;
  incidentType: typeof driverIncidents.$inferInsert.incidentType;
  occurredAt: Date;
  driverName?: string;
  severity?: string;
  value?: number;
  threshold?: number;
  locationName?: string;
};

const INCIDENT_ALIASES: Record<string, typeof driverIncidents.$inferInsert.incidentType> = {
  speed_violation: "speed_violation",
  "speed violation": "speed_violation",
  speed: "speed_violation",
  harsh_braking: "harsh_braking",
  "harsh braking": "harsh_braking",
  harsh_acceleration: "harsh_acceleration",
  "harsh acceleration": "harsh_acceleration",
  geo_fence_breach: "geo_fence_breach",
  geofence: "geo_fence_breach",
  "geo fence breach": "geo_fence_breach",
  unauthorized_movement: "unauthorized_movement",
  "unauthorized movement": "unauthorized_movement",
  idle_exceedance: "idle_exceedance",
  "idle exceedance": "idle_exceedance",
  idle: "idle_exceedance",
};

export function parseIncidentRow(
  row: string[],
  map: Map<string, number>,
  rowNumber: number
): ParsedIncidentRow | null {
  const unitKey = cell(
    row,
    resolveColumn(map, ["unit", "unit_name", "registration", "plate", "wialon_id"])
  );
  const occurredAt = parseSheetDate(
    cell(row, resolveColumn(map, ["date", "occurred_at", "datetime"]))
  );
  const typeRaw = cell(
    row,
    resolveColumn(map, ["incident_type", "incident type", "type"])
  ).toLowerCase();

  if (!unitKey || !occurredAt || !typeRaw) return null;

  const incidentType =
    INCIDENT_ALIASES[typeRaw] ??
    INCIDENT_ALIASES[typeRaw.replace(/\s+/g, "_")] ??
    null;

  if (!incidentType) return null;

  return {
    externalId:
      cell(row, resolveColumn(map, ["event_id", "id"])) ||
      `sheet-incident-${rowNumber}-${unitKey}-${occurredAt.toISOString()}`,
    unitKey,
    incidentType,
    occurredAt,
    driverName: cell(row, resolveColumn(map, ["driver_name", "driver"])) || undefined,
    severity: cell(row, resolveColumn(map, ["severity"])) || "medium",
    value: cellNumber(row, resolveColumn(map, ["value"])) || undefined,
    threshold: cellNumber(row, resolveColumn(map, ["threshold"])) || undefined,
    locationName: cell(row, resolveColumn(map, ["location", "location_name"])) || undefined,
  };
}

export type ParsedMetricRow = {
  unitKey: string;
  date: Date;
  distanceKm: number;
  engineHours: number;
  productiveHours: number;
  idleHours: number;
  fuelConsumedLiters: number;
  fuelFilledLiters: number;
};

export function parseMetricRow(
  row: string[],
  map: Map<string, number>
): ParsedMetricRow | null {
  const unitKey = cell(
    row,
    resolveColumn(map, ["unit", "unit_name", "registration", "wialon_id"])
  );
  const date = parseSheetDate(cell(row, resolveColumn(map, ["date"])));

  if (!unitKey || !date) return null;

  const engineHours = cellNumber(
    row,
    resolveColumn(map, ["engine_hours", "engine hrs", "engine hours"])
  );
  const productiveHours =
    cellNumber(
      row,
      resolveColumn(map, ["productive_hours", "productive hrs"])
    ) || engineHours * 0.75;
  const idleHours =
    cellNumber(row, resolveColumn(map, ["idle_hours", "idle hrs"])) ||
    Math.max(engineHours - productiveHours, 0);

  return {
    unitKey,
    date,
    distanceKm: cellNumber(
      row,
      resolveColumn(map, ["distance_km", "distance (km)", "distance"])
    ),
    engineHours,
    productiveHours,
    idleHours,
    fuelConsumedLiters: cellNumber(
      row,
      resolveColumn(map, ["fuel_consumed_liters", "fuel consumed (l)", "fuel (l)", "fuel"])
    ),
    fuelFilledLiters: cellNumber(
      row,
      resolveColumn(map, ["fuel_filled_liters", "fuel filled (l)", "fillings"])
    ),
  };
}

/** Kasulu live fleet sheet — all fields map 1:1 to Google Sheet columns */
export type ParsedKasuluFleetRow = {
  machineId: string;
  lastMessageAt: Date | null;
  date: Date;
  distanceKm: number;
  engineHours: number;
  initialFuelLevel: number;
  fuelFilledLiters: number;
  finalFuelLevel: number;
  fuelConsumedLiters: number;
  kmPerLiter: number;
  litersPerHour: number;
  fuelTheftLiters: number;
  comment: string;
};

/** Internal DB surrogate only — not shown in UI */
export function internalUnitIdFromSheetKey(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/** Connectivity status comes from the sheet Comment column */
export function connectivityFromSheet(
  comment: string,
  lastMessageAt: Date | null
): boolean {
  const normalized = comment.trim().toLowerCase();
  if (normalized.includes("not updating")) return false;
  if (!lastMessageAt) return false;
  return true;
}

export function parseKasuluFleetRow(
  row: string[],
  map: Map<string, number>
): ParsedKasuluFleetRow | null {
  const machineId = cell(
    row,
    resolveColumn(map, ["machine_id", "machine id", "unit", "unit_name"])
  );
  const date = parseSheetDate(cell(row, resolveColumn(map, ["date"])));

  if (!machineId || !date) return null;

  const lastMessageRaw = cell(
    row,
    resolveColumn(map, ["last_message", "last message"])
  );
  const comment = cell(row, resolveColumn(map, ["comment", "notes"]));

  return {
    machineId,
    lastMessageAt: parseSheetDate(lastMessageRaw),
    date,
    distanceKm: cellNumber(
      row,
      resolveColumn(map, ["mileage", "distance_km", "distance"])
    ),
    engineHours: cellNumber(
      row,
      resolveColumn(map, ["engine_hours", "engine hours"])
    ),
    initialFuelLevel: cellNumber(
      row,
      resolveColumn(map, ["initial_fuel_level", "initial fuel level"])
    ),
    fuelFilledLiters: cellNumber(
      row,
      resolveColumn(map, ["top_up", "top up"])
    ),
    finalFuelLevel: cellNumber(
      row,
      resolveColumn(map, ["final_fuel_level", "final fuel level"])
    ),
    fuelConsumedLiters: cellNumber(
      row,
      resolveColumn(map, ["fuel_consumed", "fuel consumed"])
    ),
    kmPerLiter: cellNumber(
      row,
      resolveColumn(map, ["consumption_(km/l)", "consumption (km/l)", "km/l"])
    ),
    litersPerHour: cellNumber(
      row,
      resolveColumn(map, ["consumption_(ltrs/hr)", "consumption (ltrs/hr)", "l/hr"])
    ),
    fuelTheftLiters: cellNumber(
      row,
      resolveColumn(map, ["fuel_theft", "fuel theft"])
    ),
    comment,
  };
}
