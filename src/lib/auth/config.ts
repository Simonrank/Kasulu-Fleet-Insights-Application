import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLogin = pathname.startsWith("/login");
      const isAuthApi = pathname.startsWith("/api/auth");
      const isHealth = pathname === "/api/health";
      const isCronSync = pathname.startsWith("/api/sync");

      if (isCronSync) {
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = request.headers.get("authorization");
        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
          return true;
        }
      }

      if (isLogin || isAuthApi || isHealth) {
        if (auth && isLogin) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      return !!auth;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
