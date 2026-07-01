import { NextResponse } from "next/server";
import { markSheetsSynced } from "@/lib/google-sheets/ensure-sync";
import { syncFromGoogleSheets } from "@/lib/google-sheets/sync";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncFromGoogleSheets();
  if (result.success) {
    markSheetsSynced();
  }

  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  });
}
