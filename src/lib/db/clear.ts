import "dotenv/config";
import { db } from "@/lib/db";
import {
  driverIncidents,
  dailyUnitMetrics,
  fuelEvents,
  syncLogs,
  units,
} from "@/lib/db/schema";

async function clear() {
  console.log("Clearing fleet data…");
  await db.delete(driverIncidents);
  await db.delete(fuelEvents);
  await db.delete(dailyUnitMetrics);
  await db.delete(units);
  await db.delete(syncLogs);
  console.log("Done. Run `npm run sync:sheets` to pull from Google Sheets.");
  process.exit(0);
}

clear().catch((error) => {
  console.error(error);
  process.exit(1);
});
