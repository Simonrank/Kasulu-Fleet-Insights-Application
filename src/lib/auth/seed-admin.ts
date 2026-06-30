import "dotenv/config";
import { ensureSuperAdminUser } from "@/lib/auth/ensure-super-admin";
import { getSuperAdminSeedConfig } from "@/lib/config/auth";

async function main() {
  const config = getSuperAdminSeedConfig();
  if (!config) {
    console.error(
      "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to seed the super admin."
    );
    process.exit(1);
  }

  await ensureSuperAdminUser();
  console.log(`Super admin ready: ${config.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
