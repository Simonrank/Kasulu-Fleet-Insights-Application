import { format } from "date-fns";
import { rowsToCsv } from "@/lib/export/csv";
import { getFuelThefts, getDriverIncidents } from "@/lib/services/analytics";
import { getFleetSummary } from "@/lib/services/fleet";
import { formatDuration } from "@/lib/fleet/theft-filters";
import { appConfig } from "@/lib/config/env";
import { formatNumber } from "@/lib/utils";

const INCIDENT_LABELS: Record<string, string> = {
  speed_violation: "Speed violation",
  harsh_braking: "Harsh braking",
  harsh_acceleration: "Harsh acceleration",
  geo_fence_breach: "Geofence breach",
  unauthorized_movement: "Unauthorized movement",
  idle_exceedance: "Excessive idle time",
};

function periodHeader(
  reportName: string,
  from: Date,
  to: Date
): (string | number | null | undefined)[][] {
  return [
    [reportName],
    [`${appConfig.name} — ${appConfig.orgLabel}`],
    [
      "Period",
      `${format(from, "dd MMM yyyy HH:mm")} — ${format(to, "dd MMM yyyy HH:mm")}`,
    ],
    ["Generated", format(new Date(), "dd MMM yyyy HH:mm")],
    [],
  ];
}

export type ExportReportType = "fuel" | "violations" | "locations";

export type ReportRow = string | number | null | undefined;
export type ReportRows = ReportRow[][];

export async function getReportRows(
  type: ExportReportType,
  from: Date,
  to: Date
): Promise<ReportRows> {
  switch (type) {
    case "fuel":
      return buildFuelReportRows(from, to);
    case "violations":
      return buildViolationsReportRows(from, to);
    case "locations":
      return buildVehicleLocationsRows();
  }
}

async function buildFuelReportRows(from: Date, to: Date): Promise<ReportRows> {
  const data = await getFuelThefts(from, to, "all");
  const { overview } = data;

  const rows: ReportRows = [
    ...periodHeader("Fuel Report", from, to),
    ["Fleet Summary"],
    ["Total fleet", overview.totalFleet],
    ["Distance (km)", overview.distanceKm.toFixed(1)],
    ["Fuel consumed (L)", overview.fuelConsumedLiters.toFixed(1)],
    ["Consumption (km/L)", overview.kmPerLiter.toFixed(2)],
    ["Consumption (L/hr)", overview.litersPerHour.toFixed(2)],
    ["Engine hours", overview.engineHours.toFixed(1)],
    ["Direct theft (L)", overview.directTheft.volumeLiters.toFixed(1)],
    ["Direct theft events", overview.directTheft.count],
    ["Return pipe theft (L)", overview.returnPipeTheft.volumeLiters.toFixed(1)],
    ["Return pipe theft events", overview.returnPipeTheft.count],
    ["Fuel fillings (L)", overview.fuelFillings.volumeLiters.toFixed(1)],
    ["Fuel drains (L)", overview.fuelDrains.volumeLiters.toFixed(1)],
    [],
    [
      "Unit",
      "Category",
      "Distance (km)",
      "Fuel consumed (L)",
      "Engine hrs",
      "Km/L",
      "L/hr",
      "hrs/L",
      "Direct theft (L)",
      "Return pipe theft (L)",
      "Total theft (L)",
    ],
  ];

  for (const row of data.fleetTable) {
    rows.push([
      row.reg,
      row.category,
      row.distanceKm.toFixed(1),
      row.fuelConsumedLiters.toFixed(1),
      row.engineHours.toFixed(1),
      row.kmPerLiter.toFixed(2),
      row.litersPerHour.toFixed(2),
      row.hoursPerLiter.toFixed(2),
      row.directTheftLiters.toFixed(1),
      row.returnPipeTheftLiters.toFixed(1),
      row.totalTheftLiters.toFixed(1),
    ]);
  }

  rows.push([]);
  rows.push([
    "Date",
    "Unit",
    "Theft type",
    "Volume (L)",
    "Duration",
    "Location",
    "Description",
  ]);

  for (const event of data.events) {
    rows.push([
      format(new Date(event.occurredAt), "dd MMM yyyy HH:mm"),
      event.unitName,
      event.theftType === "return_pipe" ? "Return pipe" : "Direct",
      event.volumeLiters.toFixed(1),
      formatDuration(event.durationMinutes),
      event.locationName,
      event.description,
    ]);
  }

  return rows;
}

async function buildViolationsReportRows(
  from: Date,
  to: Date
): Promise<ReportRows> {
  const [fuelData, incidents] = await Promise.all([
    getFuelThefts(from, to, "all"),
    getDriverIncidents(from, to),
  ]);

  const rows: ReportRows = [
    ...periodHeader("Violations Report", from, to),
    ["Fuel theft violations"],
    [
      "Date",
      "Unit",
      "Theft type",
      "Volume (L)",
      "Duration",
      "Location",
      "Description",
    ],
  ];

  for (const event of fuelData.events) {
    rows.push([
      format(new Date(event.occurredAt), "dd MMM yyyy HH:mm"),
      event.unitName,
      event.theftType === "return_pipe" ? "Return pipe" : "Direct",
      event.volumeLiters.toFixed(1),
      formatDuration(event.durationMinutes),
      event.locationName,
      event.description,
    ]);
  }

  rows.push([]);
  rows.push(["Driver behaviour violations"]);
  rows.push([
    "Date",
    "Unit",
    "Driver",
    "Incident type",
    "Severity",
    "Value",
    "Threshold",
    "Location",
  ]);

  for (const row of incidents) {
    rows.push([
      format(new Date(row.occurredAt), "dd MMM yyyy HH:mm"),
      row.unitName,
      row.driverName,
      INCIDENT_LABELS[row.incidentType] ?? row.incidentType,
      row.severity,
      row.value,
      row.threshold,
      row.locationName,
    ]);
  }

  rows.push([]);
  rows.push([
    "Summary",
    `${fuelData.events.length} fuel theft events`,
    `${incidents.length} driver incidents`,
  ]);

  return rows;
}

async function buildVehicleLocationsRows(): Promise<ReportRows> {
  const fleet = await getFleetSummary();

  const rows: ReportRows = [
    ["Current Vehicle Locations"],
    [`${appConfig.name} — ${appConfig.orgLabel}`],
    ["Generated", format(new Date(), "dd MMM yyyy HH:mm")],
    ["Note", "Coordinates from last Wialon telemetry message"],
    [],
    [
      "Registration",
      "Unit name",
      "Category",
      "Vehicle type",
      "Driver",
      "Status",
      "Connectivity",
      "Latitude",
      "Longitude",
      "Last update",
      "Maps link",
    ],
  ];

  for (const unit of fleet.units) {
    const isUpdating = unit.isOnline;

    const lat = unit.lastLat;
    const lon = unit.lastLon;
    const mapsLink =
      lat != null && lon != null
        ? `https://www.google.com/maps?q=${lat},${lon}`
        : "";

    rows.push([
      unit.plateNumber ?? "",
      unit.name,
      unit.category,
      unit.vehicleType,
      unit.driverName,
      unit.status,
      isUpdating ? "Updating" : "Non-updating",
      lat != null ? lat.toFixed(6) : "",
      lon != null ? lon.toFixed(6) : "",
      unit.lastMessageAt
        ? format(new Date(unit.lastMessageAt), "dd MMM yyyy HH:mm")
        : "",
      mapsLink,
    ]);
  }

  return rows;
}

export async function buildExportCsv(
  type: ExportReportType,
  from: Date,
  to: Date
): Promise<string> {
  const rows = await getReportRows(type, from, to);
  return rowsToCsv(rows);
}

const REPORT_TITLES: Record<ExportReportType, string> = {
  fuel: "Fuel Report",
  violations: "Violations Report",
  locations: "Vehicle Locations",
};

export function reportTitle(type: ExportReportType): string {
  return REPORT_TITLES[type];
}

export function exportFilename(
  type: ExportReportType,
  from: Date,
  to: Date,
  ext: string
): string {
  const stamp = format(new Date(), "yyyy-MM-dd");
  const range = `${format(from, "yyyy-MM-dd")}_to_${format(to, "yyyy-MM-dd")}`;
  switch (type) {
    case "fuel":
      return `kasulu-fuel-report_${range}_${stamp}.${ext}`;
    case "violations":
      return `kasulu-violations-report_${range}_${stamp}.${ext}`;
    case "locations":
      return `kasulu-vehicle-locations_${stamp}.${ext}`;
  }
}
