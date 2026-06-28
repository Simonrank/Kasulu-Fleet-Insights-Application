import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { google, type sheets_v4 } from "googleapis";
import { googleSheetsConfig } from "@/lib/config/env";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

function loadCredentials(): ServiceAccountCredentials | null {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson) as ServiceAccountCredentials;
    } catch {
      return null;
    }
  }

  const credentialsPath = resolve(process.cwd(), googleSheetsConfig.credentialsPath);
  if (!existsSync(credentialsPath)) {
    return null;
  }

  try {
    return JSON.parse(
      readFileSync(credentialsPath, "utf-8")
    ) as ServiceAccountCredentials;
  } catch {
    return null;
  }
}

export function createSheetsClient(): sheets_v4.Sheets | null {
  const credentials = loadCredentials();
  if (!credentials?.client_email || !credentials?.private_key) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: googleSheetsConfig.spreadsheetId,
    range,
  });

  return (response.data.values ?? []) as string[][];
}
