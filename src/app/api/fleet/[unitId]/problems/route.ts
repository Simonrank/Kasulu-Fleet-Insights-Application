import { NextResponse } from "next/server";
import { getUnitProblems } from "@/lib/services/fleet";
import { withSheetData } from "@/lib/google-sheets/with-sheet-data";

type RouteParams = { params: Promise<{ unitId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { unitId } = await params;
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "from and to query parameters are required" },
        { status: 400 }
      );
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);

    const data = await withSheetData(() => getUnitProblems(unitId, from, to));
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch unit problems";
    const status = message === "Unit not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
