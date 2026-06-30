import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { google, type sheets_v4 } from "googleapis";
import { googleSheetsConfig } from "@/lib/config/env";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

function loadCredentials(): ServiceAccountCredentials | null {
  const inlineJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ??
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson) as ServiceAccountCredentials;
      return normalizeCredentials(parsed);
    } catch {
      return null;
    }
  }

  const credentialsPath = resolve(process.cwd(), googleSheetsConfig.credentialsPath);
  const fallbackPaths = [
    credentialsPath,
    resolve(process.cwd(), "kasulu-7a22083d7cc2.json"),
  ];

  for (const path of fallbackPaths) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(
        readFileSync(path, "utf-8")
      ) as ServiceAccountCredentials;
      const normalized = normalizeCredentials(parsed);
      if (normalized) return normalized;
    } catch {
      // try next path
    }
  }

  return null;
}

function normalizeCredentials(
  credentials: ServiceAccountCredentials
): ServiceAccountCredentials | null {
  if (!credentials?.client_email || !credentials?.private_key) {
    return null;
  }

  return {
    client_email: credentials.client_email.trim(),
    private_key: credentials.private_key.replace(/\\n/g, "\n").trim(),
  };
}

/** True when inline JSON or a local credentials file is available. */
export function hasGoogleSheetsCredentials(): boolean {
  return loadCredentials() != null;
}

let sheetsClient: sheets_v4.Sheets | null = null;

export function createSheetsClient(): sheets_v4.Sheets | null {
  if (sheetsClient) return sheetsClient;

  const credentials = loadCredentials();
  if (!credentials?.client_email || !credentials?.private_key) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export async function fetchSheetRange(
  range: string
): Promise<string[][]> {
  const sheets = createSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets credentials not configured");
  }

  if (!googleSheetsConfig.spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  }

  return fetchSheetRangeSingle(sheets, range);
}

/** Fetch multiple ranges in one Google Sheets API round-trip. */
export async function fetchSheetRanges(
  ranges: string[]
): Promise<Map<string, string[][]>> {
  const sheets = createSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets credentials not configured");
  }

  if (!googleSheetsConfig.spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  }

  if (ranges.length === 0) {
    return new Map();
  }

  if (ranges.length === 1) {
    const rows = await fetchSheetRangeSingle(sheets, ranges[0]);
    return new Map([[ranges[0], rows]]);
  }

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: googleSheetsConfig.spreadsheetId,
    ranges,
  });

  const result = new Map<string, string[][]>();
  const valueRanges = response.data.valueRanges ?? [];

  for (let i = 0; i < ranges.length; i++) {
    result.set(
      ranges[i],
      (valueRanges[i]?.values ?? []) as string[][]
    );
  }

  return result;
}

async function fetchSheetRangeSingle(
  sheets: sheets_v4.Sheets,
  range: string
): Promise<string[][]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: googleSheetsConfig.spreadsheetId,
    range,
  });

  return (response.data.values ?? []) as string[][];
}
