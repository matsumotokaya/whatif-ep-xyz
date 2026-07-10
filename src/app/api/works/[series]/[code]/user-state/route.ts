import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/club/access";
import { hasPurchasedWallpaper } from "@/lib/wallpaper-purchases";
import { getSavedWorkIds } from "@/lib/work-saves";

interface RouteContext {
  params: Promise<{ series: string; code: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { series, code } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const projectId = searchParams.get("projectId");
  const purchaseOnly = searchParams.get("purchaseOnly") === "1";
  const [savedWorkIds, access] = await Promise.all([
    purchaseOnly ? Promise.resolve([]) : getSavedWorkIds(),
    purchaseOnly && projectId
      ? getClubAccess()
      : Promise.resolve(null),
  ]);

  let purchased = false;
  if (projectId && access?.user && access.status !== "premium") {
    purchased = await hasPurchasedWallpaper(access.user.id, projectId);
  }

  return NextResponse.json(
    { series, code, savedWorkIds, purchased },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
