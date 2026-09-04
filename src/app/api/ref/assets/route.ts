import { NextRequest, NextResponse } from "next/server";
import {
  getRefAssetsByIds,
  listRefAssets,
  projectRefAssets,
  REF_ASSET_FIELDS,
  resolveRefAssetFields,
} from "@/lib/ref/assets";

// Ref Library index for LIBRARY ASSETS: lists the site's official, curated
// image library (public.default_images — character cutouts and general art)
// with each image already resolved to a public R2 URL, so external tools (MCP
// clients, curl/CLI, Remotion, video-generation APIs) can reference an official
// asset without downloading and re-uploading it.
//
// Read-only and FULLY PUBLIC — both query shapes. Unlike /api/ref/designs,
// whose listing is restricted to the ref owners because `banners` holds every
// user's private work, this table is a curated library published by the site
// itself: it is meant to be browsed, and enumerating it leaks nothing. See
// src/lib/ref/assets.ts.
//
//   GET /api/ref/assets?id=uuid1,uuid2
//     Exact lookup. Response order matches the request; unresolvable ids come
//     back in `missing`. Returns the FULL record per asset.
//
//   GET /api/ref/assets
//     ?search=0313                     (name ilike)
//     ?role=character_cutout|general   (asset_role)
//     ?tag=character                   (tags array contains, case-insensitive)
//     ?work=313                        (work_number)
//     ?minWidth=2000                   only assets at least this wide
//     ?limit=50             (1..200)   window size
//     ?offset=0                        window start
//     ?fields=id,name,url              return EXACTLY these fields, plus `id`
//                                      (omit for the compact record;
//                                      `fields=all` for the full one)
//
// IMAGES. Every asset in this library has a full-size image at `url` and a
// recorded pixel size, so `width`/`height` describe the image at `url` exactly
// — the same strict rule /api/ref/designs follows, satisfied here without the
// design side's caveats about unrendered documents. `thumbnailUrl` is a small
// preview whose pixel size is not recorded and is deliberately not reported;
// never treat it as a full-size source. `refUrl` never needs requesting, it is
// always https://whatif-ep.xyz/ref/asset/{id}.
//
// PAGING. `count` is the number of records in THIS response; `total` is how
// many assets match the filters, ignoring limit/offset. count < total means the
// window truncated the result.
//
// `fields` SELECTS rather than adds, exactly as on /api/ref/designs: naming
// fields returns exactly those, plus `id`. `fields=all` is the full record.
//
// `tag` MATCHES CASE-INSENSITIVELY, because the stored tags are not consistent
// (33 rows "Character", one "character"). See listRefAssets in
// src/lib/ref/assets.ts.
//
// NOT /api/lab/assets. That route reads the same table but keeps its own,
// established response shape, which the lab prototypes and the Remotion
// workspace's scripts/fetch-assets.mjs consume verbatim; this one speaks Ref
// Library semantics (id lookup, count/total, fields, refUrl). The two coexist
// on purpose — changing the lab shape would break those consumers.

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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = params
    .get("id")
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  try {
    if (ids && ids.length > 0) {
      const { assets, missing } = await getRefAssetsByIds(ids);
      return jsonResponse({
        count: assets.length,
        total: assets.length,
        // An explicit id lookup is the caller naming exactly what it wants, so
        // it DEFAULTS to the full record like MCP get_asset does; `fields`
        // still narrows it if asked, rather than being silently ignored.
        assets: projectRefAssets(
          assets,
          resolveRefAssetFields(params.get("fields"), REF_ASSET_FIELDS)
        ),
        ...(missing.length > 0 ? { missing } : {}),
      });
    }

    const { assets, total } = await listRefAssets({
      search: params.get("search")?.trim() || undefined,
      role: params.get("role")?.trim() || undefined,
      tag: params.get("tag")?.trim() || undefined,
      work: parseNumber(params.get("work")),
      limit: parseNumber(params.get("limit")),
      offset: parseNumber(params.get("offset")),
      minWidth: parseNumber(params.get("minWidth")),
    });

    return jsonResponse({
      count: assets.length,
      total,
      assets: projectRefAssets(
        assets,
        resolveRefAssetFields(params.get("fields"))
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
      // The library changes far less often than saved designs (curated uploads,
      // not per-save renders), so it caches five times longer.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
