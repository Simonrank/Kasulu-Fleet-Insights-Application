import { NextResponse } from "next/server";
import { syncFromWialon } from "@/lib/wialon/sync";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncFromWialon();
  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  });
}
