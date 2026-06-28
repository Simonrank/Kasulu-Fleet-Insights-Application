export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prefetchFleetDataset } = await import(
      "@/lib/google-sheets/fleet-dataset"
    );
    prefetchFleetDataset();
  }
}
