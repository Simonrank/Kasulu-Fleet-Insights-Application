import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { defaultPermissionsForRole } from "@/lib/auth/permissions";
import { db, schema } from "@/lib/db";

function readSuperAdminEmail(): string {
  return (
    process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ??
    "simon@controltech-ea.com"
  );
}

function readSuperAdminPassword(): string | null {
  const value = process.env.SUPER_ADMIN_PASSWORD?.trim();
  return value || null;
}

function readSuperAdminName(): string {
  return process.env.SUPER_ADMIN_NAME?.trim() ?? "Simon";
}

/** Creates or updates the configured super-admin account on startup. */
export async function ensureSuperAdminUser(): Promise<void> {
  const password = readSuperAdminPassword();
  if (!password) return;

  const email = readSuperAdminEmail();
  const name = readSuperAdminName();
  const passwordHash = await hashPassword(password);
  const permissions = defaultPermissionsForRole("super_admin");

  const existing = await db
    .select()
    .from(schema.appUsers)
    .where(eq(schema.appUsers.email, email))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.appUsers)
      .set({
        name,
        role: "super_admin",
        permissions,
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.appUsers.id, existing[0].id));
    return;
  }

  await db.insert(schema.appUsers).values({
    email,
    name,
    role: "super_admin",
    permissions,
    passwordHash,
    isActive: true,
  });
}
