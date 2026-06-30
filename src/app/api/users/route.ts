import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAppUser,
  listAppUsers,
  updateAppUser,
} from "@/lib/auth/users";
import { requireSuperAdmin } from "@/lib/auth/session";
import { defaultPermissionsForRole } from "@/lib/auth/permissions";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["viewer"]),
  permissions: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await listAppUsers();
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = createUserSchema.parse(await request.json());
    const user = await createAppUser({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role,
      permissions:
        body.permissions ?? defaultPermissionsForRole(body.role),
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create user";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperAdmin();
    const body = z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        role: z.enum(["super_admin", "admin", "operator", "viewer"]).optional(),
        permissions: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(await request.json());

    const user = await updateAppUser(body.id, {
      name: body.name,
      role: body.role,
      permissions: body.permissions,
      isActive: body.isActive,
      password: body.password,
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to update user";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : message === "User not found"
            ? 404
            : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
