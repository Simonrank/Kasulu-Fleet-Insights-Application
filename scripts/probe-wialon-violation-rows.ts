import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { createWialonClient } = await import("../src/lib/wialon/client");
  const { wialonUnixDayInterval } = await import("../src/lib/wialon/day-interval");
  const { wialonConfig } = await import("../src/lib/config/env");

  const client = createWialonClient();
  if (!client) process.exit(1);

  const day = { year: 2026, month: 6, day: 27 };
  const { from, to } = wialonUnixDayInterval(day);
  const groupId = Number(wialonConfig.reportGroupId);

  try {
    await client.setLocale();
    const result = await client.runGroupReport(from, to, groupId);
    const tables = result.reportResult?.tables ?? [];
    const vIdx = tables.findIndex((t) =>
      (t.label ?? t.name ?? "").toLowerCase().includes("violation")
    );
    if (vIdx < 0) {
      console.log("No violations table");
      return;
    }
    const table = tables[vIdx];
    const rawRows = await client.fetchTableRows(vIdx, table);
    console.log("Sample violation rows (first 8):");
    for (const row of rawRows.slice(0, 8)) {
      const cells = (row.c ?? []).map((c) =>
        typeof c === "object" && c && "t" in c ? c.t : String(c ?? "")
      );
      console.log(cells.join(" | "));
    }
  } finally {
    await client.logout();
  }
}

main().catch(console.error);
