import { eq } from "drizzle-orm";
import { defaultPermissionsForRole } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";

export type PublicAppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toPublicUser(row: typeof schema.appUsers.$inferSelect): PublicAppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: row.permissions,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(schema.appUsers)
    .where(eq(schema.appUsers.email, normalized))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAppUsers(): Promise<PublicAppUser[]> {
  const rows = await db
    .select()
    .from(schema.appUsers)
    .orderBy(schema.appUsers.createdAt);
  return rows.map(toPublicUser);
}

export async function createAppUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  permissions?: string[];
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const permissions =
    input.permissions ?? defaultPermissionsForRole(input.role);
  const passwordHash = await hashPassword(input.password);

  const [row] = await db
    .insert(schema.appUsers)
    .values({
      email,
      name: input.name.trim(),
      passwordHash,
      role: input.role,
      permissions,
    })
    .returning();

  return toPublicUser(row);
}

export async function updateAppUser(
  id: string,
  input: {
    name?: string;
    role?: UserRole;
    permissions?: string[];
    isActive?: boolean;
    password?: string;
  }
) {
  const updates: Partial<typeof schema.appUsers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name != null) updates.name = input.name.trim();
  if (input.role != null) updates.role = input.role;
  if (input.permissions != null) updates.permissions = input.permissions;
  if (input.isActive != null) updates.isActive = input.isActive;
  if (input.password) {
    updates.passwordHash = await hashPassword(input.password);
  }

  const [row] = await db
    .update(schema.appUsers)
    .set(updates)
    .where(eq(schema.appUsers.id, id))
    .returning();

  if (!row) throw new Error("User not found");
  return toPublicUser(row);
}
