import { NextResponse } from "next/server";
import { markSheetsSynced } from "@/lib/google-sheets/ensure-sync";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";

export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // Vercel Cron (when CRON_SECRET is configured in the project)
  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.startsWith("vercel-cron/");
}

async function runSheetsSync() {
  const result = await syncFromGoogleSheets();
  if (result.success) {
    markSheetsSynced();
  }
  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  });
}

/** Vercel Cron invokes scheduled jobs with GET. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSheetsSync();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSheetsSync();
}
