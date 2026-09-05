import { NextResponse } from "next/server";
import { getRefTemplateLayers } from "@/lib/ref/templates";

// Ref Library: the LAYER STRUCTURE of one design template.
//
//   GET /api/ref/templates/{id}/layers
//
// 🔴 THIS IS THE ONLY WAY TO USE A TEMPLATE'S ARTWORK FROM OUTSIDE, and the
// reason the templates kind exists here at all. A template has no flattened
// full-size render and no image permalink — /api/ref/templates therefore hands
// out no `url`, only a small `thumbnailUrl`. The document behind it, though, is
// complete: the elements in draw order, each with its geometry and (for images)
// the public URL of its ORIGINAL source file. That is what lets a Remotion
// composition animate a template's background, character cutout and caption
// separately, and it needs no rendering step because `elements` is a stored
// column, not a derived one.
//
// The response is byte-identical in shape to /api/ref/designs/{id}/layers — the
// same pure mapper produces both — so a consumer that can render one can render
// the other with no branching.
//
// FIDELITY. Image layers need no re-rendering: their URL is the source file the
// editor itself loads, so placing it at the given geometry reproduces that part
// exactly (`exact: true`). Text is laid out by the editor's canvas engine and
// will differ slightly in a DOM renderer (`exact: false`). The `fidelity` block
// states this per template, machine-readably. Elements with `visible: false`
// are omitted, so drawing everything returned lands on the picture the gallery
// thumbnail shows.
//
// SCOPE: fully public, including unpublished and premium templates — the same
// deliberate, temporary decision the collection route documents. See
// src/lib/ref/templates.ts.
//
// No transformation-parameter guard here (the one REF_TRANSFORM_PARAMS gives
// the /ref image aliases): this route returns JSON, not an image, so `?w=1920`
// promises nothing it could silently fail to do.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let template;
  try {
    // Null covers both an unknown id and a non-uuid (getRefTemplateLayers
    // screens the id with isUuid before querying), so one 404 answers both.
    template = await getRefTemplateLayers(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(template, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
