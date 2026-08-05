import { NextRequest, NextResponse } from "next/server";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ series: string; code: string }> }
) {
  const { series, code } = await params;
  const parsedVariant = Number.parseInt(
    request.nextUrl.searchParams.get("variant") ?? "",
    10
  );
  const variant = Number.isFinite(parsedVariant) && parsedVariant > 0
    ? parsedVariant
    : 1;
  const pack = await getPublishedWallpaperPack(series, code, variant);
  if (!pack?.cover) {
    return NextResponse.json({ error: "Cover not found." }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(pack.cover.publicUrl, {
      next: { revalidate: 3600 },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch cover." },
      { status: 502 }
    );
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Failed to fetch cover." },
      { status: 502 }
    );
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || pack.cover.mimeType || "image/png"
  );
  headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
  );
  headers.set("X-Content-Type-Options", "nosniff");
  return new NextResponse(upstream.body, { status: 200, headers });
}
