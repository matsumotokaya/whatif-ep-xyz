import { NextRequest, NextResponse } from "next/server";
import { getRefDesignsByIds, listRefDesigns } from "@/lib/ref/designs";

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
//     `missing`.
//
//   GET /api/ref/designs
//     ?search=teaser        (name ilike)
//     ?limit=50             (1..200)
//     Listing and search, RESTRICTED to the ref owners (REF_OWNER_USER_IDS,
//     falling back to profiles.role = 'admin'). Enumeration stays scoped so no
//     one can harvest every user's design ids — see src/lib/ref/designs.ts for
//     why the two paths differ.
//
// Each design carries `url` (direct public image, usable as an image
// reference), `refUrl` (stable alias that redirects to the current render) and
// `editUrl` (open in the editor).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.trim() || undefined;
  const limitParam = params.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const ids = params
    .get("id")
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  try {
    const { designs, missing } =
      ids && ids.length > 0
        ? await getRefDesignsByIds(ids)
        : {
            designs: await listRefDesigns({
              search,
              limit: Number.isNaN(limit) ? undefined : limit,
            }),
            missing: [] as string[],
          };

    return NextResponse.json(
      {
        count: designs.length,
        designs,
        ...(missing.length > 0 ? { missing } : {}),
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
