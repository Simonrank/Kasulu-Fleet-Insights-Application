import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";
import { syncFromWialon } from "@/lib/wialon/sync";
import {
  appConfig,
  isGoogleSheetsConfigured,
  isWialonConfigured,
} from "@/lib/config/env";

export type FullSyncResult = {
  success: boolean;
  wialon: Awaited<ReturnType<typeof syncFromWialon>> | null;
  sheets: Awaited<ReturnType<typeof syncFromGoogleSheets>> | null;
  message: string;
};

export async function syncAllSources(): Promise<FullSyncResult> {
  const sheetsConfigured = isGoogleSheetsConfigured();
  const wialonConfigured = isWialonConfigured();

  if (!sheetsConfigured && !wialonConfigured) {
    return {
      success: false,
      wialon: null,
      sheets: null,
      message:
        "Configure GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_FLEET_RANGE.",
    };
  }

  const sheets = sheetsConfigured ? await syncFromGoogleSheets() : null;
  const wialon = wialonConfigured ? await syncFromWialon() : null;

  const success =
    (sheets?.success ?? !sheetsConfigured) &&
    (wialon?.success ?? !wialonConfigured);

  const parts = [sheets?.message, wialon?.message].filter(Boolean);

  return {
    success,
    wialon,
    sheets,
    message: parts.join(" · ") || "Sync completed",
  };
}
