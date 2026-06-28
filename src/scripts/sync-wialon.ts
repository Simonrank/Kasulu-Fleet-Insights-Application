import "dotenv/config";
import { syncFromWialon } from "@/lib/wialon/sync";

async function main() {
  const result = await syncFromWialon();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
