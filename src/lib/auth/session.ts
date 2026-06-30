import type { Session } from "next-auth";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }

  interface User {
    role: string;
    permissions: string[];
  }
}

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (!isSuperAdmin(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session.user;
}
