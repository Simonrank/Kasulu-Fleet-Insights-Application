import "dotenv/config";
import { syncAllSources } from "@/lib/sync/orchestrator";

async function main() {
  const result = await syncAllSources();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
