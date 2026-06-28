import type { FleetCategory } from "@/lib/fleet/categories";

export type { FleetCategory };
export type TheftFilter = "direct" | "return_pipe" | "all";
export type TheftType = "direct" | "return_pipe";
export type DurationBand = "all" | "short" | "medium" | "long" | "extended";

export type DateRange = {
  from: Date;
  to: Date;
};

export type FleetDataSource = "google_sheets" | "wialon";

export type UnitLatestRow = {
  unitId: string;
  reg: string;
  name: string;
  lastMessageAt: string | null;
  locationLabel: string | null;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  distanceKm: number;
};

export type SpeedViolationsSummary = {
  totalEvents: number;
  totalMileageKm: number;
  byUnit: Array<{
    unitName: string;
    count: number;
    maxSpeedKmh: number;
    totalDurationMinutes: number;
    mileageKm: number;
  }>;
  events: Array<{
    id: string;
    unitName: string;
    durationMinutes: number;
    speedKmh: number;
    speedLimitKmh: number;
    mileageKm: number;
    occurredAt: string | null;
  }>;
};

export type DashboardBundle = {
  kpis: KpiSummary;
  thefts: FuelTheftsResponse;
  fleet: FleetSummary;
  unitLatest: UnitLatestRow[];
  speedViolations: SpeedViolationsSummary;
  fetchedAt: string;
  /** Which upstream source produced this bundle */
  dataSource?: "google_sheets" | "wialon";
};

export type KpiSummary = {
  consumptionKmPerLiter: number;
  consumptionLitersPerHour: number;
  totalDistanceKm: number;
  totalEngineHours: number;
  utilizationPercent: number;
  updatingUnits: number;
  nonUpdatingUnits: number;
  totalUnits: number;
  directThefts: { count: number; volumeLiters: number };
  returnPipeThefts: { count: number; volumeLiters: number };
  period: { from: string; to: string };
};

export type UtilizationUnitRow = {
  unitId: string;
  unitName: string;
  driverName: string | null;
  engineHours: number;
  productiveHours: number;
  idleHours: number;
  utilizationPercent: number;
};

export type UtilizationSummary = {
  fleet: {
    utilizationPercent: number;
    targetPercent: number;
    engineHours: number;
    productiveHours: number;
    idleHours: number;
  };
  byUnit: UtilizationUnitRow[];
  period: { from: string; to: string };
};

export type FleetUnitRow = {
  id: string;
  wialonId: number;
  name: string;
  plateNumber: string | null;
  vehicleType: string | null;
  category: string;
  categoryKey: FleetCategory;
  driverName: string | null;
  status: string;
  isOnline: boolean;
  isUpdating: boolean;
  lastMessageAt: string | null;
  lastLat: number | null;
  lastLon: number | null;
  lastSpeedKmh?: number | null;
};

export type FleetSummary = {
  summary: {
    total: number;
    heavyMachines: number;
    lightVehicles: number;
    updating: number;
    nonUpdating: number;
    active: number;
    inactive: number;
    maintenance: number;
  };
  units: FleetUnitRow[];
};

export type ConnectivityFilter = "updating" | "non_updating" | "all";

export type UnitProblem = {
  id: string;
  category:
    | "connectivity"
    | "status"
    | "fuel_theft"
    | "driver_incident"
    | "utilization";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  occurredAt: string | null;
};

export type UnitProblemsResponse = {
  unit: FleetUnitRow;
  summary: {
    totalProblems: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  problems: UnitProblem[];
  period: { from: string; to: string };
};

export type UnitPerformance = {
  unitId: string;
  unitName: string;
  driverName: string | null;
  theftCount: number;
  theftVolumeLiters: number;
  theftRate: number;
  rank: number;
};

export type FuelTheftDetail = {
  id: string;
  unitId: string;
  unitName: string;
  theftType: TheftType;
  volumeLiters: number;
  durationMinutes: number | null;
  occurredAt: string;
  locationName: string | null;
  description: string | null;
};

export type FuelFleetRow = {
  unitId: string;
  reg: string;
  category: string;
  distanceKm: number;
  fuelConsumedLiters: number;
  directTheftLiters: number;
  returnPipeTheftLiters: number;
  totalTheftLiters: number;
  kmPerLiter: number;
  litersPerHour: number;
  hoursPerLiter: number;
  engineHours: number;
};

export type FuelTheftsResponse = {
  overview: {
    totalFleet: number;
    distanceKm: number;
    kmPerLiter: number;
    litersPerHour: number;
    hoursPerLiter: number;
    directTheft: { count: number; volumeLiters: number };
    returnPipeTheft: { count: number; volumeLiters: number };
    fuelFillings: { count: number; volumeLiters: number };
    fuelDrains: { count: number; volumeLiters: number };
    fuelConsumedLiters: number;
    engineHours: number;
  };
  theftByCategory: Array<{
    category: string;
    categoryKey: FleetCategory;
    directLiters: number;
    returnPipeLiters: number;
    totalLiters: number;
  }>;
  fleetTable: FuelFleetRow[];
  summary: {
    direct: { count: number; volumeLiters: number };
    returnPipe: { count: number; volumeLiters: number };
    total: { count: number; volumeLiters: number };
  };
  topViolators: UnitPerformance[];
  bestPerformers: UnitPerformance[];
  events: FuelTheftDetail[];
};

export type DriverIncidentRow = {
  id: string;
  unitId: string;
  unitName: string;
  driverName: string | null;
  incidentType: string;
  severity: string;
  value: number | null;
  threshold: number | null;
  occurredAt: string;
  locationName: string | null;
};

export type ReportSummary = {
  period: "daily" | "weekly" | "monthly" | "yearly";
  from: string;
  to: string;
  fleet: {
    distanceKm: number;
    engineHours: number;
    fuelLiters: number;
    utilizationPercent: number;
    theftCount: number;
    incidentCount: number;
  };
  byUnit: Array<{
    unitName: string;
    distanceKm: number;
    engineHours: number;
    fuelLiters: number;
    kmPerLiter: number;
    litersPerHour: number;
    theftCount: number;
  }>;
  variance: Array<{
    metric: string;
    actual: number;
    target: number;
    deviationPercent: number;
    status: "positive" | "negative" | "neutral";
  }>;
};

export type WialonUnit = {
  id: number;
  nm: string;
  pos?: { x: number; y: number; t: number };
  lmsg?: { t: number };
};

export type WialonReportRow = Record<string, string | number>;
