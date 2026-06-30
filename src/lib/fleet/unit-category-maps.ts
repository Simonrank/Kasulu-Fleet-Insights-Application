import { normalizeAssetName } from "@/lib/fleet/asset-names";

export type CategoryMapUnit = {
  id: string;
  categoryKey: string | null;
  name: string;
  plateNumber?: string | null;
};

/** Build lookup maps for category filtering by unit id or normalized name/plate. */
export function buildUnitCategoryMaps(units: CategoryMapUnit[]): {
  unitCategoryById: Map<string, string | null>;
  unitCategoryByName: Map<string, string | null>;
} {
  const unitCategoryById = new Map<string, string | null>();
  const unitCategoryByName = new Map<string, string | null>();

  for (const unit of units) {
    unitCategoryById.set(unit.id, unit.categoryKey);
    unitCategoryByName.set(normalizeAssetName(unit.name), unit.categoryKey);
    if (unit.plateNumber) {
      unitCategoryByName.set(
        normalizeAssetName(unit.plateNumber),
        unit.categoryKey
      );
    }
  }

  return { unitCategoryById, unitCategoryByName };
}
