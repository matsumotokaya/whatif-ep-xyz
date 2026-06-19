import { NextRequest, NextResponse } from "next/server";
import { getWorkBySeriesAndCode } from "@/lib/works";
import { getVariantOriginalUrl } from "@/lib/work-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(filename: string) {
  const cleaned = filename.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned.length > 0 ? cleaned : "whatif.png";
}

function resolveExtension(storageKeyOrUrl: string): "png" | "jpg" | "webp" {
  let target = storageKeyOrUrl;
  try {
    if (/^https?:\/\//i.test(storageKeyOrUrl)) {
      target = new URL(storageKeyOrUrl).pathname;
    }
  } catch {
    target = storageKeyOrUrl;
  }

  const lower = target.toLowerCase();
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
  { params }: { params: Promise<{ series: string; code: string }> }
) {
  const { series, code } = await params;
  const work = await getWorkBySeriesAndCode(series, code);

  if (!work) {
    return NextResponse.json({ error: "Work not found." }, { status: 404 });
  }

  const variantNumber = Number.parseInt(
    request.nextUrl.searchParams.get("variant") ?? "",
    10
  );
  const variant =
    work.variants.find((item) => item.variantNumber === variantNumber) ??
    work.primaryVariant;

  if (!variant?.originalStorageKey) {
    return NextResponse.json({ error: "Variant not found." }, { status: 404 });
  }

  const requestedFilename = request.nextUrl.searchParams.get("filename");
  const defaultFilename = `whatif-${work.displayCode}-${variant.variantNumber}.${resolveExtension(
    variant.originalStorageKey
  )}`;
  const filename = sanitizeFilename(requestedFilename ?? defaultFilename);
  const sourceUrl = getVariantOriginalUrl(variant);

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
