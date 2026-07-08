import { NextResponse } from "next/server";
import { getWorkCardsPageBySeries, WORKS_PAGE_SIZE } from "@/lib/works";

interface RouteContext {
  params: Promise<{ series: string }>;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request, context: RouteContext) {
  const { series } = await context.params;
  const { searchParams } = new URL(request.url);

  const offset = parsePositiveInt(searchParams.get("offset"), 0);
  const limit = parsePositiveInt(searchParams.get("limit"), WORKS_PAGE_SIZE);
  const rangeStart = searchParams.get("rangeStart");
  const rangeEnd = searchParams.get("rangeEnd");
  const idsParam = searchParams.get("ids");

  const page = await getWorkCardsPageBySeries(series, {
    sort: searchParams.get("sort") === "oldest" ? "oldest" : "newest",
    offset,
    limit,
    rangeStart: rangeStart ? parsePositiveInt(rangeStart, 0) : undefined,
    rangeEnd: rangeEnd ? parsePositiveInt(rangeEnd, 0) : undefined,
    tagSlug: searchParams.get("tag"),
    wallpaperOnly: searchParams.get("wallpaperOnly") === "1",
    ids: idsParam
      ? idsParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
  });

  return NextResponse.json(page);
}
