/** Central React Query keys — keeps prefetch and hooks aligned. */
export const fleetQueryKeys = {
  sheetDateRange: () => ["sheet-date-range"] as const,
  unitLocationsLive: () => ["unit-locations", "live"] as const,
  dashboard: (from: string, to: string) => ["dashboard", from, to] as const,
  speedViolations: (from: string, to: string) =>
    ["speed-violations", from, to] as const,
  unitLocations: (from: string, to: string) =>
    ["unit-locations", from, to] as const,
  driverIncidents: (from: string, to: string) =>
    ["driver-incidents", from, to] as const,
  reports: (from: string, to: string) => ["reports", from, to] as const,
  fleet: () => ["fleet"] as const,
  unitProblems: (unitId: string, from: string, to: string) =>
    ["unit-problems", unitId, from, to] as const,
};
