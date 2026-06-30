/** Category display from source data only — no keyword inference or defaults. */

export function fleetCategoryLabel(
  vehicleCategory?: string | null,
  vehicleType?: string | null
): string {
  const raw = (vehicleCategory ?? vehicleType ?? "").trim();
  return raw || "—";
}

export function fleetCategoryKey(
  vehicleCategory?: string | null,
  vehicleType?: string | null
): string | null {
  const label = fleetCategoryLabel(vehicleCategory, vehicleType);
  return label === "—" ? null : label;
}

export function tallyFleetByCategory(
  units: { category: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const unit of units) {
    const key =
      unit.category.trim() && unit.category !== "—"
        ? unit.category.trim()
        : "Uncategorized";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

export function tallyFleetStatus(
  units: { status: string }[]
): { active: number; inactive: number; maintenance: number } {
  let active = 0;
  let inactive = 0;
  let maintenance = 0;

  for (const unit of units) {
    if (unit.status === "maintenance") maintenance++;
    else if (unit.status === "inactive") inactive++;
    else active++;
  }

  return { active, inactive, maintenance };
}
