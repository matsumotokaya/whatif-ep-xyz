import { NextRequest, NextResponse } from "next/server";
import { getRefDesign, stripImageExtension } from "@/lib/ref/designs";

// Stable public alias for one saved IMAGINE design's rendered image.
//
//   GET /ref/{id}          -> 302 to the current full-res R2 render
//   GET /ref/{id}.jpg      -> same (the extension is cosmetic, for consumers
//                             that sniff the URL suffix)
//   GET /ref/{id}?size=thumb -> 302 to the list thumbnail
//
// R2 keys are immutable and revisioned, so the underlying URL changes whenever
// the design is re-rendered. This route is the reference that does not: it can
// be pasted into a prompt, a Remotion composition or a video API and always
// resolves to the latest render.
//
// Any design whose id you know resolves here, whichever account saved it: the
// uuid IS the access capability, which is what makes a /ref/{id} URL copied out
// of /mydesign shareable with a tool or a person who has no account. 404 means
// the id does not exist or has never been rendered, not that it is someone
// else's. The image behind it is a world-readable R2 object anyway — see the
// trust model in src/lib/ref/designs.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = stripImageExtension(rawId);

  let design;
  try {
    design = await getRefDesign(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (!design) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const wantsThumb = request.nextUrl.searchParams.get("size") === "thumb";
  const target = wantsThumb ? design.thumbnailUrl : design.url;

  if (!target) {
    return NextResponse.json(
      { error: "No rendered image yet" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // Short s-maxage only: the target URL rotates on every re-render, so the
  // redirect itself must stay cheap to invalidate while the image it points at
  // is immutable and cached hard by R2.
  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=0, s-maxage=60",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
