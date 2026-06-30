import { NextResponse } from "next/server";
import {
  isGoogleSheetsConfigured,
  isMobileStatusConfigured,
  isTelematicsConfigured,
} from "@/lib/config/env";
import { hasGoogleSheetsCredentials } from "@/lib/google-sheets/client";

/** Lightweight config check — no external API calls. */
export async function GET() {
  const sheetsConfigured = isGoogleSheetsConfigured();
  const sheetsCredentials = hasGoogleSheetsCredentials();
  const telematicsConfigured = isTelematicsConfigured();
  const databaseConfigured = !!process.env.DATABASE_URL?.trim();

  const ok = sheetsConfigured && sheetsCredentials;

  return NextResponse.json(
    {
      ok,
      sheets: {
        configured: sheetsConfigured,
        credentials: sheetsCredentials,
        spreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim(),
        fleetRange: !!process.env.GOOGLE_SHEETS_FLEET_RANGE?.trim(),
      },
      telematics: {
        configured: telematicsConfigured,
        mobileStatus: isMobileStatusConfigured(),
      },
      database: { configured: databaseConfigured },
        hints: ok
        ? []
        : [
            !sheetsConfigured &&
              "Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_FLEET_RANGE.",
            sheetsConfigured &&
              !sheetsCredentials &&
              "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY (full JSON, not a file path).",
            sheetsConfigured &&
              sheetsCredentials &&
              "Use the full data column range, e.g. Sheet1!A:M (do not cap rows if the sheet is sorted by date).",
          ].filter(Boolean),
    },
    { status: ok ? 200 : 503 }
  );
}
