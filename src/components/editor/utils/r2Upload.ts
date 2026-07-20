import { getSupabase } from './supabase';
import type { AssetKey } from '@/lib/asset';

interface PresignResponse {
  url: string;
}

const R2_UPLOAD_TIMEOUT_MS = 60_000;

// Request a presigned PUT URL from the `r2-presign` Edge Function. The function
// verifies the caller's Supabase JWT (attached automatically by functions.invoke)
// and enforces that the key is writable by this user before signing.
const requestPresignedPutUrl = async (
  key: string,
  contentType: string,
): Promise<string> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke<PresignResponse>('r2-presign', {
    body: { key, contentType },
  });

  if (error) {
    throw new Error(`Failed to get R2 presigned URL: ${error.message}`);
  }
  if (!data?.url) {
    throw new Error('R2 presign returned no URL');
  }
  return data.url;
};

// Upload a blob to R2 via a presigned PUT and return the asset KEY (never a
// URL). `key` is a full object key including the logical bucket prefix
// (e.g. `user-images/{uid}/...` or `default-images/...`). The DB stores this
// key; the URL is composed only at render time via resolveAsset.
export const uploadAsset = async (
  key: AssetKey,
  blob: Blob,
  contentType: string,
): Promise<AssetKey> => {
  const presignedUrl = await requestPresignedPutUrl(key, contentType);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), R2_UPLOAD_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`R2 upload timed out after ${R2_UPLOAD_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (${response.status}): ${detail}`);
  }

  return key;
};

interface DeleteResponse {
  deleted?: string[];
  error?: string;
  results?: Array<{ key: string; ok: boolean; status: number }>;
}

// Delete one or more objects from R2 via the `r2-presign` Edge Function
// (op: 'delete'). The function verifies the caller's Supabase JWT and enforces
// the same per-key permission model as uploads. `keys` are full object keys
// including the logical bucket prefix. Mirrors removeFilesFromBucket: a no-op
// on an empty list, idempotent, and throwing on failure.
export const deleteAssets = async (keys: Array<AssetKey | string>): Promise<void> => {
  const uniqueKeys = [...new Set(keys.filter(Boolean))] as string[];
  if (uniqueKeys.length === 0) return;

  const response = await fetch('/api/editor/assets/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      backend: 'r2',
      keys: uniqueKeys,
    }),
  });

  const data = (await response.json().catch(() => null)) as DeleteResponse | null;

  if (!response.ok || data?.error) {
    const detail = data?.error || `status_${response.status}`;
    throw new Error(`R2 delete failed: ${detail}`);
  }
};

// Convenience wrapper for deleting a single key.
export const deleteAsset = async (key: AssetKey | string): Promise<void> => {
  await deleteAssets([key]);
};
