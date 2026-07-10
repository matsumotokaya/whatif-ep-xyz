import { NextResponse } from "next/server";
import { getPurchasedDisplayCodes } from "@/lib/wallpaper-purchases";
import { getSavedWorkIds } from "@/lib/work-saves";

interface RouteContext {
  params: Promise<{ series: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { series } = await context.params;
  const [savedWorkIds, purchasedCodes] = await Promise.all([
    getSavedWorkIds(),
    getPurchasedDisplayCodes(series),
  ]);

  return NextResponse.json(
    { savedWorkIds, purchasedCodes },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
