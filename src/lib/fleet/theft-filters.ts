import type { DurationBand, FuelTheftDetail, TheftFilter } from "@/lib/types";
import type { FleetCategory } from "@/lib/fleet/categories";

export type VehicleTypeFilter = "all" | "heavy_machine" | "light_vehicle";

export const VEHICLE_TYPE_FILTER_OPTIONS: {
  value: VehicleTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "All vehicle types" },
  { value: "heavy_machine", label: "Heavy machines" },
  { value: "light_vehicle", label: "Light vehicles" },
];

export const DURATION_BANDS: {
  value: DurationBand;
  label: string;
  min: number;
  max: number | null;
}[] = [
  { value: "all", label: "All duration bands", min: 0, max: null },
  { value: "short", label: "Short (< 5 min)", min: 0, max: 5 },
  { value: "medium", label: "Medium (5–15 min)", min: 5, max: 15 },
  { value: "long", label: "Long (15–30 min)", min: 15, max: 30 },
  { value: "extended", label: "Extended (> 30 min)", min: 30, max: null },
];

export function getDurationBand(
  durationMinutes: number | null | undefined
): DurationBand | null {
  if (durationMinutes == null) return null;
  if (durationMinutes < 5) return "short";
  if (durationMinutes < 15) return "medium";
  if (durationMinutes < 30) return "long";
  return "extended";
}

export function matchesDurationBand(
  durationMinutes: number | null | undefined,
  band: DurationBand
): boolean {
  if (band === "all") return true;
  const eventBand = getDurationBand(durationMinutes);
  return eventBand === band;
}

export function filterTheftEvents(
  events: FuelTheftDetail[],
  options: {
    search: string;
    theftType: TheftFilter;
    durationBand: DurationBand;
    vehicleType?: VehicleTypeFilter;
    unitCategoryById?: Map<string, FleetCategory>;
    unitId?: string | null;
  }
): FuelTheftDetail[] {
  const query = options.search.trim().toLowerCase();

  return events.filter((event) => {
    if (options.unitId && event.unitId !== options.unitId) {
      return false;
    }

    if (options.theftType !== "all" && event.theftType !== options.theftType) {
      return false;
    }

    if (!matchesDurationBand(event.durationMinutes, options.durationBand)) {
      return false;
    }

    if (
      options.vehicleType &&
      options.vehicleType !== "all" &&
      options.unitCategoryById
    ) {
      const category = options.unitCategoryById.get(event.unitId);
      if (category !== options.vehicleType) {
        return false;
      }
    }

    if (!query) return true;

    const theftLabel =
      event.theftType === "return_pipe" ? "return pipe" : "direct";
    const durationLabel = event.durationMinutes
      ? `${event.durationMinutes} min`
      : "";

    const haystack = [
      event.unitName,
      theftLabel,
      event.description,
      event.locationName,
      durationLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
