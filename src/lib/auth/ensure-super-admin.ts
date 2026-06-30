import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { defaultPermissionsForRole } from "@/lib/auth/permissions";
import { getSuperAdminSeedConfig } from "@/lib/config/auth";
import { db, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";

const SUPER_ADMIN_ROLE: UserRole = "super_admin";

/** Creates or updates the super-admin account from environment variables. */
export async function ensureSuperAdminUser(): Promise<void> {
  const config = getSuperAdminSeedConfig();
  if (!config) return;

  const passwordHash = await hashPassword(config.password);
  const permissions = defaultPermissionsForRole(SUPER_ADMIN_ROLE);

  const existing = await db
    .select()
    .from(schema.appUsers)
    .where(eq(schema.appUsers.email, config.email))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.appUsers)
      .set({
        name: config.name,
        role: SUPER_ADMIN_ROLE,
        permissions,
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.appUsers.id, existing[0].id));
    return;
  }

  await db.insert(schema.appUsers).values({
    email: config.email,
    name: config.name,
    role: SUPER_ADMIN_ROLE,
    permissions,
    passwordHash,
    isActive: true,
  });
}
