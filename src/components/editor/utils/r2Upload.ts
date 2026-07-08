import { getSupabase } from './supabase';
import type { AssetKey } from '@/lib/asset';

interface PresignResponse {
  url: string;
}

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

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (${response.status}): ${detail}`);
  }

  return key;
};

// Upload through the app's own origin instead of browser -> R2 direct PUT.
// This avoids any dependency on Cloudflare bucket CORS for save flows that
// originate from authenticated UI actions such as banner thumbnail generation.
export const uploadAssetViaApi = async (
  key: AssetKey,
  blob: Blob,
  contentType: string,
): Promise<AssetKey> => {
  const formData = new FormData();
  formData.set('key', key);
  formData.set('contentType', contentType);
  formData.set('file', blob, key.split('/').pop() || 'asset');

  const response = await fetch('/api/editor/assets/upload', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Editor asset upload failed (${response.status}): ${detail}`);
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

  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke<DeleteResponse>('r2-presign', {
    body: { op: 'delete', keys: uniqueKeys },
  });

  if (error) {
    throw new Error(`R2 delete failed: ${error.message}`);
  }
  if (data?.error) {
    throw new Error(`R2 delete failed: ${data.error}`);
  }
};

// Convenience wrapper for deleting a single key.
export const deleteAsset = async (key: AssetKey | string): Promise<void> => {
  await deleteAssets([key]);
};
