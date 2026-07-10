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

const MAX_SUPABASE_DELETE_PATHS = 100;
const MAX_SUPABASE_PATH_LENGTH = 1024;
const MAX_SUPABASE_PATH_SEGMENT_LENGTH = 255;

const isWritableUserAssetKey = (key: string, userId: string): boolean =>
  key.startsWith(`user-images/${userId}/`);

const isWritableDefaultImageKey = (key: string): boolean =>
  key.startsWith("default-images/");

// Supabase Storage expects paths relative to the selected bucket. Keep the
// accepted form deliberately strict so ownership checks cannot be bypassed by
// alternate spellings that a downstream URL/path parser may normalize.
function normalizeSupabaseStoragePath(path: string): string | null {
  if (
    path.length === 0 ||
    path.length > MAX_SUPABASE_PATH_LENGTH ||
    path !== path.trim() ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return null;
  }

  // Callers already decode paths extracted from public URLs. Reject encoded
  // variants instead of risking a second decoding step turning them into a
  // separator or traversal segment.
  try {
    if (decodeURIComponent(path) !== path) {
      return null;
    }
  } catch {
    return null;
  }

  const segments = path.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment.length > MAX_SUPABASE_PATH_SEGMENT_LENGTH ||
        segment === "." ||
        segment === ".." ||
        segment !== segment.trim(),
    )
  ) {
    return null;
  }

  return segments.join("/");
}

const isOwnedUserImagePath = (path: string, userId: string): boolean =>
  path.split("/", 1)[0] === userId;

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
      if (body.paths.length > MAX_SUPABASE_DELETE_PATHS) {
        return NextResponse.json({ error: "too_many_paths" }, { status: 413 });
      }

      const normalizedPaths = body.paths.map((path) =>
        typeof path === "string" ? normalizeSupabaseStoragePath(path) : null,
      );
      if (normalizedPaths.some((path) => path === null)) {
        return NextResponse.json({ error: "invalid_path" }, { status: 400 });
      }

      const paths = [...new Set(normalizedPaths as string[])];
      if (paths.length === 0) {
        return NextResponse.json({ ok: true, deleted: [] });
      }

      const bucketAllowed =
        bucket === "user-images" || (isAdmin && bucket === "default-images");
      if (!bucketAllowed) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      // The admin-only Storage Cleanup page deletes RPC-vetted orphan/fullres
      // objects across users. Other callers may only delete objects rooted in
      // their own UUID directory inside the legacy user-images bucket.
      if (
        bucket === "user-images" &&
        !isAdmin &&
        !paths.every((path) => isOwnedUserImagePath(path, user.id))
      ) {
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
