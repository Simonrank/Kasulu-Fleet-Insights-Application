function readOptionalTrimmed(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

export type SuperAdminSeedConfig = {
  email: string;
  name: string;
  password: string;
};

/** Seed config is available only when both email and password env vars are set. */
export function getSuperAdminSeedConfig(): SuperAdminSeedConfig | null {
  const password = readOptionalTrimmed("SUPER_ADMIN_PASSWORD");
  const email = readOptionalTrimmed("SUPER_ADMIN_EMAIL");

  if (!password || !email) return null;

  const name = readOptionalTrimmed("SUPER_ADMIN_NAME") ?? email.split("@")[0] ?? email;

  return {
    email: email.toLowerCase(),
    name,
    password,
  };
}

export function getAuthSecret(): string | undefined {
  return readOptionalTrimmed("AUTH_SECRET") ?? undefined;
}
