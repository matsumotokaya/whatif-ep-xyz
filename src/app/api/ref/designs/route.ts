import { NextRequest, NextResponse } from "next/server";
import {
  getRefDesignsByIds,
  listRefDesigns,
  projectRefDesigns,
  REF_DESIGN_FIELDS,
  resolveRefDesignFields,
} from "@/lib/ref/designs";

// Ref Library index: lists saved IMAGINE designs (public.banners) with their
// rendered image already resolved to a public R2 URL, so external tools (MCP
// clients, curl/CLI, Remotion, video-generation APIs) can reference a design
// without exporting and re-uploading it.
//
// Read-only, and its scope depends on the query shape:
//
//   GET /api/ref/designs?id=uuid1,uuid2
//     Exact lookup, ANY owner. The design uuid is the access capability, so a
//     caller who knows an id resolves it regardless of which account saved it.
//     Response order matches the request; unresolvable ids come back in
//     `missing`. Returns the FULL record per design.
//
//   GET /api/ref/designs
//     ?search=teaser        (name ilike)
//     ?limit=50             (1..200)   window size
//     ?offset=0                        window start
//     ?renderedOnly=true               only designs with a full-res render
//     ?minWidth=2000                   only designs at least this wide (implies
//                                      renderedOnly)
//     ?fields=refUrl,thumbnailUrl      add fields to the compact record, or
//                                      `fields=all` for the full one
//     Listing and search, RESTRICTED to the ref owners (REF_OWNER_USER_IDS,
//     falling back to profiles.role = 'admin'). Enumeration stays scoped so no
//     one can harvest every user's design ids — see src/lib/ref/designs.ts for
//     why the two paths differ.
//
// IMAGES. `url` is the FULL-RESOLUTION render and nothing else: it is null when
// a design has never been rendered at full size, and `width`/`height` then are
// null too. They describe the image at `url` exactly, so a consumer that trusts
// them cannot be handed a ~400px thumbnail while being told it is 1080x1350 —
// which is what the previous thumbnail fallback did. `thumbnailUrl` is the
// small preview under its own name (roughly 400px wide; the exact size is not
// guaranteed and is deliberately not reported). `docWidth`/`docHeight` are the
// design document's own dimensions and are present even with nothing rendered.
//
// LIST RESPONSE SIZE. A listing returns a compact record by default —
// id, name, width, height, docWidth, docHeight, aspect, urlKind, url, stale —
// because at limit=200 the full record cost an LLM client ~46k tokens, mostly
// the same uuid repeated across four long URLs. The dropped fields come back
// via `fields`. Two of them never need asking for, they are pure functions of
// the id:
//
//   refUrl  = https://whatif-ep.xyz/ref/{id}
//   editUrl = https://whatif-ep.xyz/edit/{id}
//
// PAGING. `count` is the number of records in THIS response; `total` is how
// many designs match the filters, ignoring limit/offset. count < total means
// the window truncated the result.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const parseNumber = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

// Absent means false; "false"/"0"/"no" mean false too, so a client that always
// sends the parameter can still turn the filter off.
const parseBoolean = (value: string | null): boolean => {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && !["false", "0", "no", "off"].includes(normalized);
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.trim() || undefined;
  const ids = params
    .get("id")
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  try {
    if (ids && ids.length > 0) {
      const { designs, missing } = await getRefDesignsByIds(ids);
      return jsonResponse({
        count: designs.length,
        total: designs.length,
        // An explicit id lookup is the caller naming exactly what it wants, so
        // it gets the full record like MCP get_design does.
        designs: projectRefDesigns(designs, REF_DESIGN_FIELDS),
        ...(missing.length > 0 ? { missing } : {}),
      });
    }

    const { designs, total } = await listRefDesigns({
      search,
      limit: parseNumber(params.get("limit")),
      offset: parseNumber(params.get("offset")),
      renderedOnly: parseBoolean(params.get("renderedOnly")),
      minWidth: parseNumber(params.get("minWidth")),
    });

    return jsonResponse({
      count: designs.length,
      total,
      designs: projectRefDesigns(
        designs,
        resolveRefDesignFields(params.get("fields"))
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

function jsonResponse(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
