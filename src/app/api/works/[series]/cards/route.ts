import { NextResponse } from "next/server";
import {
  getWorkCardsPageBySeries,
  WORKS_MAX_PAGE_SIZE,
  WORKS_PAGE_SIZE,
} from "@/lib/works";

interface RouteContext {
  params: Promise<{ series: string }>;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: RouteContext) {
  const { series } = await context.params;
  const { searchParams } = new URL(request.url);

  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? parsePositiveInt(cursorParam, 0) : null;
  const limit = Math.min(
    parsePositiveInt(searchParams.get("limit"), WORKS_PAGE_SIZE),
    WORKS_MAX_PAGE_SIZE
  );
  const rangeStart = searchParams.get("rangeStart");
  const rangeEnd = searchParams.get("rangeEnd");
  const idsParam = searchParams.get("ids");

  const ids = idsParam
    ? idsParam
        .split(",")
        .map((value) => value.trim())
        .filter((value) => UUID_PATTERN.test(value))
        .slice(0, 500)
    : undefined;

  const dataStartedAt = performance.now();
  const page = await getWorkCardsPageBySeries(series, {
    sort: searchParams.get("sort") === "oldest" ? "oldest" : "newest",
    cursor,
    limit,
    rangeStart: rangeStart ? parsePositiveInt(rangeStart, 0) : undefined,
    rangeEnd: rangeEnd ? parsePositiveInt(rangeEnd, 0) : undefined,
    tagSlug: searchParams.get("tag"),
    wallpaperOnly: searchParams.get("wallpaperOnly") === "1",
    ids,
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": idsParam
        ? "private, no-store"
        : "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      "Server-Timing": `gallery-data;dur=${(
        performance.now() - dataStartedAt
      ).toFixed(1)}`,
    },
  });
}
