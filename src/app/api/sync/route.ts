import { NextResponse } from "next/server";
import { syncAllSources } from "@/lib/sync/orchestrator";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllSources();
  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  });
}
