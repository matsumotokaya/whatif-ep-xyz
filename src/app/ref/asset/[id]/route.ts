import { NextRequest, NextResponse } from "next/server";
import { getRefAsset, stripImageExtension } from "@/lib/ref/assets";

// Stable public alias for one official library asset's image
// (public.default_images), the counterpart of /ref/{id} for saved designs.
//
//   GET /ref/asset/{id}            -> 302 to the FULL-SIZE R2 image
//   GET /ref/asset/{id}.jpg        -> same (the extension is cosmetic, for
//                                     consumers that sniff the URL suffix)
//   GET /ref/asset/{id}?size=thumb -> 302 to the small preview
//
// ROUTING. `asset` is a static segment, so Next matches /ref/asset/{id} here
// and never against the sibling dynamic /ref/[id] — a literal segment always
// outranks a dynamic one at the same depth. Design references are therefore
// unaffected; only a design whose uuid were literally "asset" could collide,
// which no uuid can be.
//
// The bare form resolves the FULL-SIZE image only; ?size=thumb is the one way
// to get the preview, so nothing can hand a caller a small image while calling
// it the asset. Every row in this library has both, so a 404 here means the id
// is unknown, not that the image is pending.
//
// Public and unscoped, like the rest of the library — see src/lib/ref/assets.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NOT_FOUND_MESSAGE =
  "Asset not found. Check the id against GET /api/ref/assets, or list the library with the list_assets MCP tool.";

const NO_IMAGE_MESSAGE =
  "This library asset has no full-size image. Add ?size=thumb to this URL to get the small preview instead (its exact pixel size is not recorded).";

const NO_THUMBNAIL_MESSAGE =
  "This library asset has no thumbnail. Drop ?size=thumb from this URL to get the full-size image instead.";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = stripImageExtension(rawId);

  let asset;
  try {
    asset = await getRefAsset(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (!asset) {
    return NextResponse.json(
      { error: NOT_FOUND_MESSAGE },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const wantsThumb = request.nextUrl.searchParams.get("size") === "thumb";
  const target = wantsThumb ? asset.thumbnailUrl : asset.url;

  if (!target) {
    return NextResponse.json(
      { error: wantsThumb ? NO_THUMBNAIL_MESSAGE : NO_IMAGE_MESSAGE },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // Library objects are immutable once uploaded, but the row could be repointed
  // at a new file, so the redirect itself stays cheap to invalidate while the
  // image behind it is cached hard by R2.
  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
