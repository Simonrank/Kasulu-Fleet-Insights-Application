/** Normalize Wialon/sheet asset names for register lookup. */
export function normalizeAssetName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/MUFINDI\s*-\s*/gi, "MUFINDI: ")
    .replace(/MUFINDI:\s*/gi, "MUFINDI: ");
}

export function resolveAssetCategory(
  machineId: string,
  sheetCategory: string | null | undefined,
  register?: Map<string, string> | null
): string | null {
  const fromSheet = sheetCategory?.trim();
  if (fromSheet) return fromSheet;

  const fromRegister = register?.get(normalizeAssetName(machineId));
  return fromRegister?.trim() || null;
}
