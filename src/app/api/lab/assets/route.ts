import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { asAssetKey, resolveAsset } from "@/lib/asset";

// LAB asset resolver: exposes the default_images library (official clean
// assets — character cutouts etc.) as resolved public R2 URLs, so lab
// prototypes and the Remotion workspace can reference any library asset by
// query instead of copying files around. Read-only, public data only.
//
//   GET /api/lab/assets
//     ?role=character_cutout|general
//     ?work=407            (work_number)
//     ?tag=Character       (tags array contains)
//     ?search=0407         (name ilike)
//     ?limit=100           (max 500)

export const revalidate = 300;

interface LabAsset {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  role: string;
  tags: string[];
  workNumber: number | null;
  seriesSlug: string | null;
  variantNumber: number | null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const role = params.get("role");
  const work = params.get("work");
  const tag = params.get("tag");
  const search = params.get("search");
  const limit = Math.min(
    Math.max(Number.parseInt(params.get("limit") ?? "100", 10) || 100, 1),
    500
  );

  const supabase = createAnonClient();
  let query = supabase
    .from("default_images")
    .select(
      "id, name, storage_path, thumbnail_path, width, height, asset_role, tags, work_series_slug, work_number, variant_number"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (role) query = query.eq("asset_role", role);
  if (work) {
    const workNumber = Number.parseInt(work, 10);
    if (!Number.isNaN(workNumber)) query = query.eq("work_number", workNumber);
  }
  if (tag) query = query.contains("tags", [tag]);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assets: LabAsset[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    url: resolveAsset(asAssetKey(row.storage_path), {
      legacyBucket: "default-images",
    }),
    thumbnailUrl: row.thumbnail_path
      ? resolveAsset(asAssetKey(row.thumbnail_path), {
          legacyBucket: "default-images",
        })
      : null,
    width: row.width,
    height: row.height,
    role: row.asset_role,
    tags: row.tags ?? [],
    workNumber: row.work_number,
    seriesSlug: row.work_series_slug,
    variantNumber: row.variant_number,
  }));

  return NextResponse.json(
    { count: assets.length, assets },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
