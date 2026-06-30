import type { ParsedKasuluFleetRow } from "@/lib/google-sheets/parse";

/** Latest row per machine by sheet date (no Last Message merge). */
export function latestRowByMachineDate(
  rows: ParsedKasuluFleetRow[]
): Map<string, ParsedKasuluFleetRow> {
  const latestByMachine = new Map<string, ParsedKasuluFleetRow>();
  for (const row of rows) {
    const prev = latestByMachine.get(row.machineId);
    if (!prev || row.date > prev.date) {
      latestByMachine.set(row.machineId, row);
    }
  }
  return latestByMachine;
}

/**
 * Latest row per machine for fleet summary, merging newest Last Message
 * timestamp across all rows for that machine.
 */
export function latestSnapshotByMachine(
  rows: ParsedKasuluFleetRow[]
): Map<string, ParsedKasuluFleetRow> {
  const byMachine = new Map<string, ParsedKasuluFleetRow>();
  const newestMessage = new Map<string, Date>();

  for (const row of rows) {
    const prev = byMachine.get(row.machineId);
    if (!prev || row.date > prev.date) {
      byMachine.set(row.machineId, row);
    }

    if (row.lastMessageAt) {
      const prevMsg = newestMessage.get(row.machineId);
      if (!prevMsg || row.lastMessageAt > prevMsg) {
        newestMessage.set(row.machineId, row.lastMessageAt);
      }
    }
  }

  for (const [machineId, row] of byMachine) {
    const newest = newestMessage.get(machineId);
    if (newest && (!row.lastMessageAt || newest > row.lastMessageAt)) {
      byMachine.set(machineId, { ...row, lastMessageAt: newest });
    }
  }

  return byMachine;
}
