import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAssetKey } from "@/lib/asset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isWritableUserAssetKey = (key: string, userId: string): boolean =>
  key.startsWith(`user-images/${userId}/`);

const isWritableDefaultImageKey = (key: string): boolean =>
  key.startsWith("default-images/");

interface PresignResponse {
  url?: string;
  error?: string;
}

async function requestPresignedPutUrl(params: {
  accessToken: string;
  key: string;
  contentType: string;
}): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase environment is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/r2-presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      key: params.key,
      contentType: params.contentType,
    }),
  });

  const payload = (await response.json().catch(() => null)) as PresignResponse | null;

  if (!response.ok || !payload?.url) {
    const detail = payload?.error || `status_${response.status}`;
    throw new Error(`Presign failed: ${detail}`);
  }

  return payload.url;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
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
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";
    const canWriteDefaultImages = isAdmin && isWritableDefaultImageKey(keyValue);

    if (!canWriteDefaultImages) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    const contentType =
      contentTypeValue || fileValue.type || "application/octet-stream";
    const presignedUrl = await requestPresignedPutUrl({
      accessToken: session.access_token,
      key: keyValue,
      contentType,
    });

    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: await fileValue.arrayBuffer(),
    });

    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text().catch(() => "");
      throw new Error(`R2 PUT failed (${uploadResponse.status}): ${detail}`);
    }

    return NextResponse.json({ ok: true, key: keyValue });
  } catch (error) {
    console.error("Editor asset upload failed:", error);
    return NextResponse.json(
      {
        error: "upload_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
