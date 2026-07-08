import { getSupabase } from './supabase';
import type { AssetKey } from '@/lib/asset';

// Upload through the app's own origin instead of browser -> R2 direct PUT.
// This avoids any dependency on Cloudflare bucket CORS for every authenticated
// upload flow in the editor, including banner saves, Content Factory uploads,
// template thumbnails, and library assets.
const uploadAssetViaApi = async (
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

// Upload a blob to R2 and return the asset KEY (never a URL). All editor-side
// writes route through the same-origin proxy so browser uploads no longer rely
// on Cloudflare bucket CORS being perfectly configured.
export const uploadAsset = async (
  key: AssetKey,
  blob: Blob,
  contentType: string,
): Promise<AssetKey> => uploadAssetViaApi(key, blob, contentType);

export { uploadAssetViaApi };

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
