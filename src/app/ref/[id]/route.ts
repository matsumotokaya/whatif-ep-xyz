import { NextRequest, NextResponse } from "next/server";
import { resolveRefImageQuery } from "@/lib/ref/common";
import { getRefDesign, stripImageExtension } from "@/lib/ref/designs";

// Stable public alias for one saved IMAGINE design's rendered image.
//
//   GET /ref/{id}          -> 302 to the current FULL-RESOLUTION R2 render
//   GET /ref/{id}.jpg      -> same (the extension is cosmetic, for consumers
//                             that sniff the URL suffix)
//   GET /ref/{id}?size=thumb -> 302 to the small list thumbnail
//   GET /ref/{id}?w=1920   -> 400. This route serves the stored image as-is;
//                             see REF_TRANSFORM_PARAMS in src/lib/ref/common.ts
//                             for why an unsupported transformation is an error
//                             instead of a silently unmodified image.
//
// R2 keys are immutable and revisioned, so the underlying URL changes whenever
// the design is re-rendered. This route is the reference that does not: it can
// be pasted into a prompt, a Remotion composition or a video API and always
// resolves to the latest render.
//
// The bare form resolves the FULL-RES render ONLY. It used to fall back to the
// thumbnail, which meant a URL advertised as the design silently served a
// ~400px image — invisible to the caller and, for a paid per-call video
// generator, expensive. A design with no full-res render is now a 404 that says
// how to produce one, and the small preview stays reachable but only when it is
// asked for by name.
//
// Any design whose id you know resolves here, whichever account saved it: the
// uuid IS the access capability, which is what makes a /ref/{id} URL copied out
// of /mydesign shareable with a tool or a person who has no account. 404 means
// the id does not exist or has not been rendered, not that it is someone
// else's. The image behind it is a world-readable R2 object anyway — see the
// trust model in src/lib/ref/designs.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NO_FULLRES_MESSAGE =
  "This design has no full-resolution render yet. Open it in the IMAGINE editor and save it to produce one. Add ?size=thumb to this URL to get the small preview instead (roughly 400px wide; exact size not guaranteed).";

const NO_THUMBNAIL_MESSAGE =
  "This design has no thumbnail yet. Open it in the IMAGINE editor and save it to produce one.";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = stripImageExtension(rawId);

  // Before the lookup: a request asking for something this route cannot do is
  // wrong whether or not the design exists, and answering 400 without a DB read
  // is the cheaper of two truthful answers.
  const query = resolveRefImageQuery(request.nextUrl.searchParams);
  if (query.error !== null) {
    return NextResponse.json(
      { error: query.error },
      { status: 400, headers: CORS_HEADERS }
    );
  }

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

  const wantsThumb = query.size === "thumb";
  const target = wantsThumb ? design.thumbnailUrl : design.url;

  if (!target) {
    return NextResponse.json(
      { error: wantsThumb ? NO_THUMBNAIL_MESSAGE : NO_FULLRES_MESSAGE },
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
