export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { ensureSuperAdminUser } = await import(
        "@/lib/auth/ensure-super-admin"
      );
      await ensureSuperAdminUser();
    } catch (error) {
      console.error("[auth] Failed to ensure super admin user:", error);
    }

    try {
      const { triggerGoogleSheetsSyncIfStale } = await import(
        "@/lib/google-sheets/ensure-sync"
      );
      triggerGoogleSheetsSyncIfStale();
    } catch (error) {
      console.error("[sync] Failed to warm sheet sync:", error);
    }
  }
}
