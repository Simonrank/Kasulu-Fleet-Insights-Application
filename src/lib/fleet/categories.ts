export type FleetCategory = "heavy_machine" | "light_vehicle";

export const CATEGORY_LABELS: Record<FleetCategory, string> = {
  heavy_machine: "Heavy Machines",
  light_vehicle: "Light Vehicles",
};

const LIGHT_KEYWORDS = [
  "pickup",
  "hilux",
  "suv",
  "car",
  "van",
  "light",
  "sedan",
  "ute",
];

/** Legacy DB values mapped to heavy machines */
const HEAVY_MACHINE_ALIASES = new Set([
  "heavy_machine",
  "machine",
  "vehicle",
  "heavy machine",
  "machines",
]);

export function resolveFleetCategory(
  vehicleType?: string | null,
  vehicleCategory?: string | null
): FleetCategory {
  const cat = (vehicleCategory ?? "").toLowerCase().trim();

  if (cat === "light_vehicle" || cat === "light vehicle") {
    return "light_vehicle";
  }

  if (HEAVY_MACHINE_ALIASES.has(cat)) {
    return "heavy_machine";
  }

  const t = (vehicleType ?? "").toLowerCase();
  if (LIGHT_KEYWORDS.some((k) => t.includes(k))) {
    return "light_vehicle";
  }

  return "heavy_machine";
}

export function inferVehicleCategory(
  vehicleType?: string | null,
  name?: string | null
): FleetCategory {
  const combined = `${vehicleType ?? ""} ${name ?? ""}`.toLowerCase();
  if (LIGHT_KEYWORDS.some((k) => combined.includes(k))) {
    return "light_vehicle";
  }
  return "heavy_machine";
}

export function categoryLabel(category: FleetCategory): string {
  return CATEGORY_LABELS[category];
}
