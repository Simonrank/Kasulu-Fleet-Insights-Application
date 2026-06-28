import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { isWialonReportConfigured } = await import("../src/lib/config/env");
  const { getSpeedViolations } = await import("../src/lib/wialon/speed-violations");
  const { buildSpeedViolationsSummary } = await import(
    "../src/lib/fleet/speed-violations-analytics"
  );
  console.log("Wialon report configured:", isWialonReportConfigured());

  const from = new Date("2026-06-27T00:00:00+03:00");
  const to = new Date("2026-06-27T23:59:59+03:00");

  console.log("Fetching Wialon Speedings for 27 Jun 2026 (Dar es Salaam)...");
  const started = Date.now();

  const rows = await getSpeedViolations(from, to);
  const summary = buildSpeedViolationsSummary(rows);

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("Raw speeding rows:", rows.length);
  console.log("Summary totalEvents:", summary.totalEvents);
  console.log("Summary byUnit (top 5):");
  for (const unit of summary.byUnit.slice(0, 5)) {
    console.log(
      `  ${unit.unitName}: ${unit.count} events, max ${unit.maxSpeedKmh} km/h`
    );
  }
  if (rows[0]) {
    console.log("Sample row:", rows[0]);
  }
  if (rows.length === 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
