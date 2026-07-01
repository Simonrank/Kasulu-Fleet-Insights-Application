import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-panel flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
