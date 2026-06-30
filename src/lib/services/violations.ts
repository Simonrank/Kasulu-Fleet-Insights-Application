import { isTelematicsConfigured } from "@/lib/config/env";
import {
  applyDataDrivenSeverity,
  buildViolationsSummary,
  isFuelDrainViolation,
  mergeViolationSources,
  speedingsToIncidents,
  wialonViolationsToIncidents,
} from "@/lib/fleet/violations-model";
import type { DriverIncidentsResponse } from "@/lib/types";
import { getTelematicsSnapshot } from "@/lib/telematics/snapshot";
import { incidentWithinRange } from "@/lib/utils";

/** Driver incidents from live telematics only. */
export async function getFleetViolations(
  from: Date,
  to: Date
): Promise<DriverIncidentsResponse> {
  if (!isTelematicsConfigured()) {
    return {
      incidents: [],
      summary: buildViolationsSummary([]),
      source: "live",
    };
  }

  const snapshot = await getTelematicsSnapshot(from, to);
  if (!snapshot) {
    return {
      incidents: [],
      summary: buildViolationsSummary([]),
      source: "live",
    };
  }

  const incidents = applyDataDrivenSeverity(
    mergeViolationSources(
      wialonViolationsToIncidents(snapshot.violations, snapshot.unitIds),
      speedingsToIncidents(snapshot.speedViolations, snapshot.unitIds)
    )
  ).filter(
    (row) =>
      !isFuelDrainViolation(row) &&
      row.occurredAt != null &&
      incidentWithinRange(row.occurredAt, from, to)
  );

  return {
    incidents,
    summary: buildViolationsSummary(incidents),
    source: "live",
  };
}
