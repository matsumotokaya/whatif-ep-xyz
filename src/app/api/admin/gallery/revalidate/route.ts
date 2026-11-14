import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminAccess } from "@/lib/admin/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: expire the Gallery's cached work/production data right away.
// Content Factory calls this after renumbering variants, because the card list
// and the per-variant feed-image maps are cached separately and must refresh
// together (otherwise a slide could briefly show another variant's image).
export async function POST() {
  const access = await getAdminAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  revalidateTag("works", { expire: 0 });
  revalidateTag("production", { expire: 0 });
  return NextResponse.json({ ok: true });
}
