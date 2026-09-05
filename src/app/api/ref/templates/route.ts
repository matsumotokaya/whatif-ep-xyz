import { NextRequest, NextResponse } from "next/server";
import {
  getRefTemplatesByIds,
  listRefTemplates,
  projectRefTemplates,
  REF_TEMPLATE_FIELDS,
  resolveRefTemplateFields,
} from "@/lib/ref/templates";

// Ref Library index for DESIGN TEMPLATES: the curated starting points the
// IMAGINE gallery offers (public.templates). The third referenceable kind,
// alongside saved designs (/api/ref/designs) and the official asset library
// (/api/ref/assets).
//
// 🔴 A TEMPLATE HAS NO FULL-SIZE IMAGE, so no record here carries a `url` and
// there is no /ref/template/{id} image permalink. `public.templates` stores a
// thumbnail and nothing else, and the gallery's "wallpaper download" renders
// the full-size picture in the browser at the moment you press it rather than
// fetching a stored file — so there is no URL to hand out. What a template is
// good for here is its LAYERS: call /api/ref/templates/{id}/layers to get the
// elements in draw order with geometry, which is what an external renderer
// needs to animate the parts. `thumbnailUrl` is a small preview and is named
// for what it is; never treat it as a full-size source. See
// src/lib/ref/templates.ts.
//
// Read-only and FULLY PUBLIC on both query shapes, including unpublished and
// premium templates — a deliberate, temporary decision while the Ref Library
// is unannounced. See the scope note in src/lib/ref/templates.ts and
// docs/REF_LIBRARY.md.
//
//   GET /api/ref/templates?id=uuid1,uuid2
//     Exact lookup. Response order matches the request; unresolvable ids come
//     back in `missing`. Returns the FULL record per template.
//
//   GET /api/ref/templates
//     ?search=summer          (name ilike)
//     ?planType=free|premium  (plan_type)
//     ?minWidth=1080          only templates whose canvas is at least this wide
//     ?limit=50    (1..200)   window size
//     ?offset=0               window start
//     ?fields=id,name         return EXACTLY these fields, plus `id`
//                             (omit for the compact record; `fields=all` for
//                             the full one)
//
// PAGING. `count` is the number of records in THIS response; `total` is how
// many templates match the filters, ignoring limit/offset. count < total means
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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = params
    .get("id")
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  try {
    if (ids && ids.length > 0) {
      const { templates, missing } = await getRefTemplatesByIds(ids);
      return jsonResponse({
        count: templates.length,
        total: templates.length,
        // An explicit id lookup is the caller naming exactly what it wants, so
        // it DEFAULTS to the full record like MCP get_template does; `fields`
        // still narrows it if asked, rather than being silently ignored.
        templates: projectRefTemplates(
          templates,
          resolveRefTemplateFields(params.get("fields"), REF_TEMPLATE_FIELDS)
        ),
        ...(missing.length > 0 ? { missing } : {}),
      });
    }

    const { templates, total } = await listRefTemplates({
      search: params.get("search")?.trim() || undefined,
      planType: params.get("planType")?.trim() || undefined,
      limit: parseNumber(params.get("limit")),
      offset: parseNumber(params.get("offset")),
      minWidth: parseNumber(params.get("minWidth")),
    });

    return jsonResponse({
      count: templates.length,
      total,
      templates: projectRefTemplates(
        templates,
        resolveRefTemplateFields(params.get("fields"))
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
      // Templates are curated and change rarely, like the asset library and
      // unlike saved designs which re-render on every save.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
