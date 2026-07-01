"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { brand, brandTitle } from "@/lib/brand";

const FEATURES = [
  "Real-Time GPS Tracking",
  "Fleet Performance",
  "Driver Safety Analytics",
  "Trip Intelligence",
] as const;

const LOGIN_WARMUP_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Warm dashboard APIs while the user waits on the login screen. */
function warmDashboardAfterLogin(): void {
  void fetch("/api/sheets/date-range").catch(() => {});
  void fetch("/api/dashboard").catch(() => {});
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    setLoading(false);
    setWarmingUp(true);
    warmDashboardAfterLogin();
    await sleep(LOGIN_WARMUP_MS);

    const destination = callbackUrl.startsWith("/") ? callbackUrl : "/";
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="login-page">
      <section className="login-hero" aria-hidden={false}>
        <div className="login-hero__media-wrap">
          <Image
            src={brand.heroSrc}
            alt=""
            fill
            priority
            className="login-hero__media"
            sizes="60vw"
          />
        </div>
        <div className="login-hero__overlay" />
        <div className="login-hero__content">
          <h1 className="login-hero__headline">
            Turn <span className="login-hero__accent">live telemetry</span> into{" "}
            <span className="login-hero__accent">decision-ready insights.</span>
          </h1>
          <p className="login-hero__subtext">
            Built for {brand.orgLabel} operations teams — monitor compliance
            events, fuel and mileage efficiency, route adherence, and driver risk
            signals as they happen.
          </p>
          <ul className="login-hero__tags">
            {FEATURES.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-panel__brand-card">
            <Image
              src={brand.logoSrc}
              alt={`${brand.name} logo`}
              width={140}
              height={56}
              className="login-panel__brand-logo"
              priority
            />
          </div>

          <div className="login-card">
            <div className="login-card__badge">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Secure sign-in
            </div>

            <h2 className="login-card__title">Welcome back</h2>
            <p className="login-card__subtitle">
              Sign in to the <strong>{brandTitle()}</strong> workspace.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form__field">
                <label htmlFor="email" className="login-form__label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading || warmingUp}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-form__input"
                  placeholder="you@company.com"
                />
              </div>

              <div className="login-form__field">
                <label htmlFor="password" className="login-form__label">
                  Password
                </label>
                <div className="login-form__password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={loading || warmingUp}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-form__input login-form__input--password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="login-form__toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="login-form__error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="login-form__submit"
                disabled={loading || warmingUp}
              >
                {loading
                  ? "Signing in…"
                  : warmingUp
                    ? "Preparing dashboard…"
                    : "Sign in"}
              </button>
            </form>
          </div>

          <p className="login-panel__copyright">
            © {new Date().getFullYear()} {brand.orgLabel}. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
