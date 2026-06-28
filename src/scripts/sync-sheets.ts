import "dotenv/config";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";

async function main() {
  const result = await syncFromGoogleSheets();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
