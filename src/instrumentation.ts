export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prefetchFleetDataset } = await import(
      "@/lib/google-sheets/fleet-dataset"
    );
    prefetchFleetDataset();

    try {
      const { ensureSuperAdminUser } = await import(
        "@/lib/auth/ensure-super-admin"
      );
      await ensureSuperAdminUser();
    } catch (error) {
      console.error("[auth] Failed to ensure super admin user:", error);
    }
  }
}
