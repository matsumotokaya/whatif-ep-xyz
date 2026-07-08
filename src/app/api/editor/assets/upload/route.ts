import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAssetKey } from "@/lib/asset";
import { isR2AssetsConfigured, uploadR2AssetObject } from "@/lib/r2-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isWritableUserAssetKey = (key: string, userId: string): boolean =>
  key.startsWith(`user-images/${userId}/`);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  if (!isR2AssetsConfigured()) {
    console.error("Editor asset upload failed: R2 assets bucket is not configured.");
    return NextResponse.json({ error: "storage_unavailable" }, { status: 500 });
  }

  const formData = await request.formData();
  const keyValue = formData.get("key");
  const contentTypeValue = formData.get("contentType");
  const fileValue = formData.get("file");

  if (
    typeof keyValue !== "string" ||
    !isAssetKey(keyValue) ||
    typeof contentTypeValue !== "string" ||
    !(fileValue instanceof File)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!isWritableUserAssetKey(keyValue, user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const bytes = new Uint8Array(await fileValue.arrayBuffer());
    await uploadR2AssetObject({
      key: keyValue,
      body: bytes,
      contentType: contentTypeValue || fileValue.type || "application/octet-stream",
    });
    return NextResponse.json({ ok: true, key: keyValue });
  } catch (error) {
    console.error("Editor asset upload failed:", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
