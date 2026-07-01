import "dotenv/config";
import { closeSyncDb } from "@/lib/db/sync-client";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";

async function main() {
  try {
    const result = await syncFromGoogleSheets();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } finally {
    await closeSyncDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
