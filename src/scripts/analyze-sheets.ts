import "dotenv/config";
import { startOfDay, subDays } from "date-fns";
import { fetchSheetRange } from "@/lib/google-sheets/client";
import { googleSheetsConfig } from "@/lib/config/env";
import {
  headerIndexMap,
  parseKasuluFleetRow,
} from "@/lib/google-sheets/parse";

async function main() {
  const days = Number(process.env.GOOGLE_SHEETS_SYNC_DAYS ?? "30");
  const cutoff = startOfDay(subDays(new Date(), days));

  const rows = await fetchSheetRange(googleSheetsConfig.ranges.fleet);
  const map = headerIndexMap(rows[0]);

  let inRange = 0;
  let parsed = 0;
  const machines = new Set<string>();
  const latestByMachine = new Map<
    string,
    { date: Date; lastMessage: string | null }
  >();

  for (const row of rows.slice(1)) {
    const p = parseKasuluFleetRow(row, map);
    if (!p) continue;
    parsed++;

    const prev = latestByMachine.get(p.machineId);
    if (!prev || p.date > prev.date) {
      latestByMachine.set(p.machineId, {
        date: p.date,
        lastMessage: p.lastMessageAt?.toISOString() ?? null,
      });
    }

    if (startOfDay(p.date) >= cutoff) {
      inRange++;
      machines.add(p.machineId);
    }
  }

  console.log("Total rows:", rows.length - 1);
  console.log("Parsed rows:", parsed);
  console.log(`Rows in last ${days} days:`, inRange);
  console.log("Unique machines (in range):", machines.size);
  console.log("Unique machines (all):", latestByMachine.size);
  console.log("\nLatest row per machine (sample):");
  for (const [name, info] of [...latestByMachine.entries()].slice(0, 5)) {
    console.log(`  ${name}: ${info.date.toISOString()} | last msg ${info.lastMessage}`);
  }
}

main();
