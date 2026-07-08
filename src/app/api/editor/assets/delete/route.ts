import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAssetKey } from "@/lib/asset";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteBody =
  | { backend: "r2"; keys: string[] }
  | { backend: "supabase"; bucket: string; paths: string[] };

interface DeleteResponse {
  deleted?: string[];
  error?: string;
  results?: Array<{ key: string; ok: boolean; status: number }>;
}

const isWritableUserAssetKey = (key: string, userId: string): boolean =>
  key.startsWith(`user-images/${userId}/`);

const isWritableDefaultImageKey = (key: string): boolean =>
  key.startsWith("default-images/");

function isSupabaseDeleteBody(body: unknown): body is Extract<DeleteBody, { backend: "supabase" }> {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { backend?: string }).backend === "supabase" &&
      typeof (body as { bucket?: unknown }).bucket === "string" &&
      Array.isArray((body as { paths?: unknown[] }).paths),
  );
}

function isR2DeleteBody(body: unknown): body is Extract<DeleteBody, { backend: "r2" }> {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { backend?: string }).backend === "r2" &&
      Array.isArray((body as { keys?: unknown[] }).keys),
  );
}

async function deleteR2Keys(params: {
  accessToken: string;
  keys: string[];
}) {
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
      op: "delete",
      keys: params.keys,
    }),
  });

  const payload = (await response.json().catch(() => null)) as DeleteResponse | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `delete_failed_${response.status}`);
  }
}

export async function POST(request: Request) {
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
  const isAdmin = profile?.role === "admin";

  const body = await request.json().catch(() => null);

  try {
    if (isR2DeleteBody(body)) {
      const keys = [...new Set(body.keys.filter((key): key is string => typeof key === "string" && isAssetKey(key)))];
      if (keys.length === 0) {
        return NextResponse.json({ ok: true, deleted: [] });
      }

      const allowed = keys.every(
        (key) =>
          isWritableUserAssetKey(key, user.id) ||
          (isAdmin && isWritableDefaultImageKey(key)),
      );
      if (!allowed) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "auth_required" }, { status: 401 });
      }

      await deleteR2Keys({
        accessToken: session.access_token,
        keys,
      });
      return NextResponse.json({ ok: true, deleted: keys });
    }

    if (isSupabaseDeleteBody(body)) {
      const bucket = body.bucket;
      const paths = [...new Set(body.paths.filter((path): path is string => typeof path === "string" && path.trim().length > 0))];
      if (paths.length === 0) {
        return NextResponse.json({ ok: true, deleted: [] });
      }

      const bucketAllowed =
        bucket === "user-images" || (isAdmin && bucket === "default-images");
      if (!bucketAllowed) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      const storageClient = createAdminClient() ?? supabase;
      const { data, error } = await storageClient.storage.from(bucket).remove(paths);

      if (error) {
        throw error;
      }

      const deleted = (data ?? []).map((entry) => entry.name);
      return NextResponse.json({ ok: true, deleted });
    }

    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  } catch (error) {
    console.error("Editor asset delete failed:", error);
    return NextResponse.json(
      {
        error: "delete_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
