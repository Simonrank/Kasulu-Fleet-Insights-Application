import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--dash-bg)]">
          <p className="text-sm text-[var(--dash-muted)]">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
