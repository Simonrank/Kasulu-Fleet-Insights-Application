import { db } from "@/lib/db";
import { units } from "@/lib/db/schema";

const UNIT_ID_TTL_MS = 5 * 60_000;
const LOOKUP_TIMEOUT_MS = 2_500;

let unitIdCache: { map: Map<string, string>; fetchedAt: number } | null = null;

/**
 * machineId / unit name → Postgres UUID.
 * Cached with timeout so sheet loads never block on a slow DB.
 */
export async function loadUnitIdMap(): Promise<Map<string, string>> {
  if (!process.env.DATABASE_URL?.trim()) {
    return new Map();
  }

  if (unitIdCache && Date.now() - unitIdCache.fetchedAt < UNIT_ID_TTL_MS) {
    return unitIdCache.map;
  }

  try {
    const rows = await Promise.race([
      db.select({ id: units.id, name: units.name }).from(units),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Unit map lookup timed out")), LOOKUP_TIMEOUT_MS);
      }),
    ]);
    const map = new Map(rows.map((row) => [row.name, row.id]));
    unitIdCache = { map, fetchedAt: Date.now() };
    return map;
  } catch {
    return unitIdCache?.map ?? new Map();
  }
}

/** Invalidate after sync writes new units. */
export function invalidateUnitIdMapCache(): void {
  unitIdCache = null;
}
