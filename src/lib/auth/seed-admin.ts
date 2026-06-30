import "dotenv/config";
import { ensureSuperAdminUser } from "@/lib/auth/ensure-super-admin";

async function main() {
  if (!process.env.SUPER_ADMIN_PASSWORD?.trim()) {
    console.error("SUPER_ADMIN_PASSWORD is required to seed the super admin.");
    process.exit(1);
  }

  await ensureSuperAdminUser();
  console.log(
    `Super admin ready: ${process.env.SUPER_ADMIN_EMAIL ?? "simon@controltech-ea.com"}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
