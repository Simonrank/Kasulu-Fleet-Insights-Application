import { NextResponse } from "next/server";

/** Deprecated — use /api/telematics/speed-violations */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/telematics/speed-violations";
  return NextResponse.redirect(url, 308);
}
