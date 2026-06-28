import { NextResponse } from "next/server";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
} from "date-fns";
import { getReportSummary } from "@/lib/services/analytics";
import type { ReportSummary } from "@/lib/types";
import { withSheetData } from "@/lib/google-sheets/with-sheet-data";

function resolvePeriod(period: ReportSummary["period"]): { from: Date; to: Date } {
  const now = new Date();

  switch (period) {
    case "daily":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "weekly":
      return { from: startOfWeek(now), to: endOfWeek(now) };
    case "monthly":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "yearly":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfWeek(subWeeks(now, 1)), to: endOfWeek(subWeeks(now, 1)) };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") ?? "weekly") as ReportSummary["period"];

    const customFrom = searchParams.get("from");
    const customTo = searchParams.get("to");

    let from: Date;
    let to: Date;

    if (customFrom && customTo) {
      from = new Date(customFrom);
      to = new Date(customTo);
    } else {
      ({ from, to } = resolvePeriod(period));
    }

    const data = await withSheetData(() => getReportSummary(from, to, period));
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
