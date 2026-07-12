import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asAssetKey, resolveAsset } from "@/lib/asset";

// Video Factory banner resolver (admin only). Banners are private user
// designs, so unlike /api/lab/assets this endpoint requires an admin
// session; after the gate it reads via the service-role client so any
// banner in the workspace can be pulled into a video sequence.
//
//   GET /api/video-factory/banners?search=&limit=      -> summary list
//   GET /api/video-factory/banners?id=<uuid>[,<uuid>]  -> full fixtures,
//       in the requested order (Remotion BannerRenderer-compatible shape,
//       same as scripts/fetch-banner.sh output)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BannerRow {
  id: string;
  name: string;
  canvas_color: string | null;
  template: { width?: number; height?: number } | null;
  elements: unknown[] | null;
  thumbnail_key: string | null;
  thumbnail_url: string | null;
  updated_at: string | null;
}

function toFixture(row: BannerRow) {
  return {
    id: row.id,
    name: row.name,
    canvasColor: row.canvas_color,
    width: row.template?.width ?? null,
    height: row.template?.height ?? null,
    elements: row.elements ?? [],
  };
}

function toSummary(row: BannerRow) {
  const thumbSource = row.thumbnail_key ?? row.thumbnail_url;
  return {
    id: row.id,
    name: row.name,
    width: row.template?.width ?? null,
    height: row.template?.height ?? null,
    thumbnailUrl: thumbSource ? resolveAsset(asAssetKey(thumbSource)) : null,
    elementCount: row.elements?.length ?? 0,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const idParam = params.get("id");

  const SELECT =
    "id, name, canvas_color, template, elements, thumbnail_key, thumbnail_url, updated_at";

  if (idParam) {
    const ids = idParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length === 0) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("banners")
      .select(SELECT)
      .in("id", ids);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Preserve the caller's order — it defines the video sequence.
    const byId = new Map(
      ((data ?? []) as unknown as BannerRow[]).map((row) => [row.id, row])
    );
    const missing = ids.filter((id) => !byId.has(id));
    const fixtures = ids
      .map((id) => byId.get(id))
      .filter((row): row is BannerRow => Boolean(row))
      .map(toFixture);

    return NextResponse.json({ count: fixtures.length, missing, fixtures });
  }

  const search = params.get("search");
  const limit = Math.min(
    Math.max(Number.parseInt(params.get("limit") ?? "100", 10) || 100, 1),
    300
  );

  let query = admin
    .from("banners")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const banners = ((data ?? []) as unknown as BannerRow[]).map(toSummary);
  return NextResponse.json({ count: banners.length, banners });
}
