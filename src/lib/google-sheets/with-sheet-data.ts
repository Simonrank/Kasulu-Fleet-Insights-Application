import { triggerGoogleSheetsSyncIfStale } from "@/lib/google-sheets/ensure-sync";

/** Serve from Postgres immediately; refresh from Google Sheets in the background when stale. */
export async function withSheetData<T>(handler: () => Promise<T>): Promise<T> {
  triggerGoogleSheetsSyncIfStale();
  return handler();
}
