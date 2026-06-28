function readOptionalNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "",
  orgLabel: process.env.NEXT_PUBLIC_ORG_LABEL ?? process.env.ORG_LABEL ?? "",
  opsAreaLabel: process.env.NEXT_PUBLIC_OPS_AREA ?? "",
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES ?? "15"),
  dataSource: (process.env.DATA_SOURCE ?? "google_sheets") as
    | "google_sheets"
    | "wialon"
    | "both",
};

export const kpiTargets = {
  utilizationPercent: readOptionalNumber("KPI_TARGET_UTILIZATION"),
  kmPerLiter: readOptionalNumber("KPI_TARGET_KM_PER_LITER"),
  litersPerHour: readOptionalNumber("KPI_TARGET_LITERS_PER_HOUR"),
  maxTheftRate: readOptionalNumber("KPI_TARGET_MAX_THEFT_RATE"),
};

export function hasKpiTargets(): boolean {
  return Object.values(kpiTargets).some((v) => v != null);
}

export const googleSheetsConfig = {
  get spreadsheetId() {
    return readRequired("GOOGLE_SHEETS_SPREADSHEET_ID");
  },
  credentialsPath:
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ??
    "credentials/google-service-account.json",
  get ranges() {
    return {
      fleet: readRequired("GOOGLE_SHEETS_FLEET_RANGE"),
    };
  },
  syncDays: Number(process.env.GOOGLE_SHEETS_SYNC_DAYS ?? "7"),
};

export const wialonConfig = {
  apiUrl: process.env.WIALON_API_URL ?? "",
  token: process.env.WIALON_TOKEN ?? "",
  reportResourceId: process.env.WIALON_REPORT_RESOURCE_ID ?? "",
  reportTemplateId: process.env.WIALON_REPORT_TEMPLATE_ID ?? "",
  reportGroupId: process.env.WIALON_REPORT_GROUP_ID ?? "",
  reportTableLabel: process.env.WIALON_REPORT_TABLE_LABEL ?? "",
  reportMaxDays: Number(process.env.WIALON_REPORT_MAX_DAYS ?? "7"),
};

export function isWialonConfigured(): boolean {
  const token = wialonConfig.token;
  const hasToken = !!token && token !== "your_wialon_token_here";
  return (
    (appConfig.dataSource === "wialon" || appConfig.dataSource === "both") &&
    hasToken
  );
}

export function isWialonReportConfigured(): boolean {
  return (
    isWialonConfigured() &&
    !!wialonConfig.reportResourceId &&
    !!wialonConfig.reportTemplateId &&
    !!wialonConfig.reportGroupId
  );
}

export function isGoogleSheetsConfigured(): boolean {
  return (
    (appConfig.dataSource === "google_sheets" ||
      appConfig.dataSource === "both") &&
    !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() &&
    !!process.env.GOOGLE_SHEETS_FLEET_RANGE?.trim()
  );
}
