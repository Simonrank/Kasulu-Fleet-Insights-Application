import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { createWialonClient } = await import("../src/lib/wialon/client");
  const { wialonUnixDayInterval } = await import("../src/lib/wialon/day-interval");
  const { wialonConfig } = await import("../src/lib/config/env");

  const client = createWialonClient();
  if (!client) {
    console.error("Wialon not configured");
    process.exit(1);
  }

  const day = { year: 2026, month: 6, day: 27 };
  const { from, to } = wialonUnixDayInterval(day);
  const groupId = Number(wialonConfig.reportGroupId);

  try {
    await client.setLocale();
    const result = await client.runGroupReport(from, to, groupId);
    const tables = result.reportResult?.tables ?? [];

    console.log(`Tables (${tables.length}):`);
    for (const [i, table] of tables.entries()) {
      const label = table.label ?? table.name ?? `table_${i}`;
      console.log(`\n[${i}] ${label} — rows: ${table.rows ?? 0}, level: ${table.level ?? 1}`);
      console.log("  headers:", JSON.stringify(table.header ?? []));
    }
  } finally {
    await client.logout();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
