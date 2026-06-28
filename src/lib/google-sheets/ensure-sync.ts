import { appConfig, isGoogleSheetsConfigured } from "@/lib/config/env";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";

let lastSyncAt = 0;
let syncInFlight: Promise<void> | null = null;

/** Kick off a background Postgres refresh from Google Sheets when stale. Never blocks reads. */
export function triggerGoogleSheetsSyncIfStale(): void {
  if (!isGoogleSheetsConfigured()) return;

  const intervalMs = appConfig.syncIntervalMinutes * 60 * 1000;
  if (Date.now() - lastSyncAt < intervalMs) return;
  if (syncInFlight) return;

  syncInFlight = (async () => {
    try {
      const result = await syncFromGoogleSheets();
      if (result.success) {
        lastSyncAt = Date.now();
        const { invalidateFleetDatasetCache } = await import(
          "@/lib/google-sheets/fleet-dataset"
        );
        invalidateFleetDatasetCache();
        const { clearDashboardAggregateCache } = await import(
          "@/lib/google-sheets/dashboard-cache"
        );
        clearDashboardAggregateCache();
        const { clearUtilizationAggregateCache } = await import(
          "@/lib/google-sheets/utilization-cache"
        );
        clearUtilizationAggregateCache();
      }
    } finally {
      syncInFlight = null;
    }
  })();
}

/** @deprecated Use triggerGoogleSheetsSyncIfStale — kept for scripts that need to await sync. */
export async function ensureGoogleSheetsSynced(): Promise<void> {
  triggerGoogleSheetsSyncIfStale();
  if (syncInFlight) {
    await syncInFlight;
  }
}

export function resetSyncCache(): void {
  lastSyncAt = 0;
}

export function markSheetsSynced(): void {
  lastSyncAt = Date.now();
}
