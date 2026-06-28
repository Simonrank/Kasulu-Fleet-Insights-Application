import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { units } from "@/lib/db/schema";

export async function GET() {
  const data = await db.select().from(units).orderBy(units.name);
  return NextResponse.json(data);
}
