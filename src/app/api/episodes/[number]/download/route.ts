import { NextRequest, NextResponse } from "next/server";
import { getEpisodeByNumber } from "@/lib/episodes";
import { getOriginalUrl } from "@/lib/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(filename: string) {
  const cleaned = filename.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned.length > 0 ? cleaned : "whatif.png";
}

function resolveExtension(storageKey: string): "png" | "jpg" | "webp" {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".webp")) return "webp";
  return "png";
}

function buildContentDisposition(filename: string) {
  const safeName = filename.replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const episode = await getEpisodeByNumber(number);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }

  const requestedFilename = request.nextUrl.searchParams.get("filename");
  const defaultFilename = `whatif-${episode.number}.${resolveExtension(episode.originalStorageKey)}`;
  const filename = sanitizeFilename(requestedFilename ?? defaultFilename);
  const sourceUrl = getOriginalUrl(episode);

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch source image." },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Failed to fetch source image." },
      { status: 502 }
    );
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/octet-stream"
  );
  headers.set("Content-Disposition", buildContentDisposition(filename));
  headers.set("Cache-Control", "no-store");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
