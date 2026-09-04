import { NextResponse } from "next/server";
import { getRefDesignLayers } from "@/lib/ref/designs";

// Ref Library: the LAYER STRUCTURE of one saved IMAGINE design.
//
//   GET /api/ref/designs/{id}/layers
//
// `/api/ref/designs?id={id}` returns the design as ONE FLATTENED JPEG, which is
// what a still image needs. This route returns the document behind it instead —
// the elements, in draw order, each with its geometry and (for images) the
// public URL of its ORIGINAL source file — so a Remotion composition can
// animate a background, a character cutout and a caption separately rather than
// panning one flat picture.
//
// FIDELITY. Image layers need no re-rendering at all: their URL is the source
// file the editor itself loads, so placing it at the given geometry reproduces
// the flattened render exactly (`exact: true`). Text is laid out by the editor's
// canvas engine and will differ slightly in a DOM renderer (`exact: false`).
// The `fidelity` block states this per design, machine-readably. Elements with
// `visible: false` are omitted, so drawing everything returned lands on the same
// picture as the flattened render.
//
// SCOPE: unscoped by id, like `/api/ref/designs?id=...` — the uuid is the
// capability. This exposes more than the flattened image does (text strings and
// source asset keys, i.e. the original uploads at full resolution); see the
// access-scope note in src/lib/ref/designs.ts for why that is accepted for now
// and what is recorded to revisit.
//
// ROUTING: this nested segment does NOT shadow `GET /api/ref/designs`. It is a
// deeper path (/api/ref/designs/{id}/layers), and Next matches a route only
// against a complete path, so the collection route keeps answering
// /api/ref/designs and /api/ref/designs?id=... unchanged. Verified with a live
// request to both.
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

  let design;
  try {
    // Null covers both an unknown id and a non-uuid (getRefDesignLayers screens
    // the id with isUuid before querying), so one 404 answers both.
    design = await getRefDesignLayers(id);
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

  return NextResponse.json(design, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
