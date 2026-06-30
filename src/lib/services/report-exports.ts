import { format } from "date-fns";
import { rowsToCsv } from "@/lib/export/csv";
import { getFuelThefts, getUtilization } from "@/lib/services/analytics";
import { getFleetViolations } from "@/lib/services/violations";
import { getLiveUnitLocations } from "@/lib/telematics/locations";
import { formatDuration } from "@/lib/fleet/theft-filters";
import { incidentTypeLabel } from "@/lib/fleet/violations-model";
import { appConfig } from "@/lib/config/env";
import {
  buildCurrentAssetLocationPdfBuffer,
  locationsTableRows,
} from "@/lib/export/location-report-pdf";

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

export type ExportReportType = "fuel" | "violations" | "locations" | "utilization";

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
    case "utilization":
      return buildUtilizationReportRows(from, to);
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
      "Fuel top ups (L)",
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
      row.fuelTopUpLiters.toFixed(1),
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
  const [fuelData, violationsData] = await Promise.all([
    getFuelThefts(from, to, "all"),
    getFleetViolations(from, to),
  ]);
  const incidents = violationsData.incidents;

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
      incidentTypeLabel(row.incidentType),
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

async function buildUtilizationReportRows(
  from: Date,
  to: Date
): Promise<ReportRows> {
  const data = await getUtilization(from, to);
  const { fleet } = data;
  const fleetUtilizationPercent =
    fleet.totalEngineHours > 0
      ? (fleet.totalProductiveHours / fleet.totalEngineHours) * 100
      : 0;
  const totalViolations = data.byUnit.reduce(
    (sum, unit) => sum + unit.violationCount,
    0
  );
  const totalFuel = data.byUnit.reduce(
    (sum, unit) => sum + unit.fuelConsumedLiters,
    0
  );

  const rows: ReportRows = [
    ...periodHeader("Utilization Report", from, to),
    ["Fleet Summary"],
    ["Total distance (km)", fleet.totalDistanceKm.toFixed(1)],
    ["Total engine hours", fleet.totalEngineHours.toFixed(1)],
    ["Productive hours", fleet.totalProductiveHours.toFixed(1)],
    ["Idle hours", fleet.totalIdleHours.toFixed(1)],
    ["Avg km / engine hr", fleet.avgKmPerEngineHour.toFixed(1)],
    ["Fleet utilization (%)", fleetUtilizationPercent.toFixed(1)],
    ["Total fuel consumed (L)", totalFuel.toFixed(0)],
    ["Total violations", totalViolations],
    ["Units", data.byUnit.length],
    [],
    [
      "#",
      "Vehicle",
      "Category",
      "Distance (km)",
      "Engine hrs",
      "Km / hr",
      "Idle hrs",
      "Fuel consumed (L)",
      "Violations",
    ],
  ];

  data.byUnit.forEach((unit, index) => {
    rows.push([
      index + 1,
      unit.unitName,
      unit.category ?? "",
      unit.distanceKm.toFixed(1),
      unit.engineHours.toFixed(1),
      unit.kmPerEngineHour.toFixed(1),
      unit.idleHours.toFixed(1),
      unit.fuelConsumedLiters.toFixed(0),
      unit.violationCount,
    ]);
  });

  return rows;
}

async function buildVehicleLocationsRows(): Promise<ReportRows> {
  const rows = await getLiveUnitLocations();

  return [
    ["Current asset location"],
    [`${appConfig.name} — ${appConfig.orgLabel}`],
    ["Generated", format(new Date(), "dd MMM yyyy HH:mm")],
    ["Note", "Live ControlRoom report · sorted by speed"],
    ["Assets", rows.length],
    [],
    ["Asset", "Last message", "Location", "Speed"],
    ...locationsTableRows(rows),
  ];
}

export async function buildLocationsPdf(): Promise<Buffer> {
  const rows = await getLiveUnitLocations();
  return buildCurrentAssetLocationPdfBuffer(rows);
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
  locations: "Current Asset Location",
  utilization: "Utilization Report",
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
      return `kasulu-current-asset-location_${stamp}.${ext}`;
    case "utilization":
      return `kasulu-utilization-report_${range}_${stamp}.${ext}`;
  }
}
