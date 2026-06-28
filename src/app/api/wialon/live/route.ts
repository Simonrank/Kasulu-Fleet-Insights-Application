import { NextResponse } from "next/server";

/** Deprecated — dashboard data is served from /api/dashboard (Google Sheets). */
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint is no longer available. Use /api/dashboard." },
    { status: 410 }
  );
}
