import { googleSheetsConfig } from "@/lib/config/env";

import { fetchSheetRange } from "@/lib/google-sheets/client";

import {
  headerIndexMap,
  resolveColumn,
} from "@/lib/google-sheets/parse";

import { normalizeAssetName } from "@/lib/fleet/asset-names";



const CACHE_TTL_MS = 300_000;



/** Known register tab ranges — primary comes from env. */

const REGISTER_FALLBACK_RANGES = ["Sheet3!A:B"];



let cache: { map: Map<string, string>; fetchedAt: number } | null = null;



function detectRegisterHeaderRowIndex(rows: string[][]): number {

  const maxScan = Math.min(rows.length, 25);

  for (let i = 0; i < maxScan; i++) {

    const header = headerIndexMap(rows[i] ?? []);

    const hasName = resolveColumn(header, [

      "grouping",

      "machine_id",

      "machine id",

      "unit",

      "unit_name",

      "name",

      "asset",

    ]);

    const hasCategory = resolveColumn(header, [

      "category",

      "vehicle_category",

      "vehicle category",

      "fleet_category",

      "type",

    ]);

    if (hasName != null && hasCategory != null) return i;

  }

  return 0;

}



/** Parse Grouping + Category rows from the register tab. */

export function parseCategoryRegisterRows(rows: string[][]): Map<string, string> {

  const map = new Map<string, string>();

  if (!rows.length) return map;



  const headerRowIndex = detectRegisterHeaderRowIndex(rows);

  const header = headerIndexMap(rows[headerRowIndex]);

  const nameCol = resolveColumn(header, [

    "grouping",

    "machine_id",

    "machine id",

    "unit",

    "unit_name",

    "name",

    "asset",

  ]);

  const categoryCol = resolveColumn(header, [

    "category",

    "vehicle_category",

    "vehicle category",

    "fleet_category",

    "type",

  ]);



  if (nameCol == null || categoryCol == null) return map;



  for (const row of rows.slice(headerRowIndex + 1)) {

    const name = row[nameCol]?.trim();

    const category = row[categoryCol]?.trim();

    if (!name || !category) continue;

    map.set(normalizeAssetName(name), category);

  }



  return map;

}



export function setCategoryRegisterCache(map: Map<string, string>): void {

  cache = { map, fetchedAt: Date.now() };

}



async function fetchRegisterFromRanges(

  ranges: string[]

): Promise<Map<string, string>> {

  for (const range of ranges) {

    try {

      const rows = await fetchSheetRange(range);

      const map = parseCategoryRegisterRows(rows);

      if (map.size > 0) return map;

    } catch (error) {

      console.warn(

        `[category-register] Skipped invalid range "${range}":`,

        error instanceof Error ? error.message : error

      );

    }

  }

  return new Map();

}



/** Asset name → category from the fleet register sheet tab. */

export async function getCategoryRegister(): Promise<Map<string, string>> {

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {

    return cache.map;

  }



  const primary = googleSheetsConfig.registerRange?.trim();

  const ranges = [

    ...(primary ? [primary] : []),

    ...REGISTER_FALLBACK_RANGES.filter((r) => r !== primary),

  ];



  const map = await fetchRegisterFromRanges(ranges);

  cache = { map, fetchedAt: Date.now() };

  return map;

}



export function invalidateCategoryRegisterCache(): void {

  cache = null;

}


