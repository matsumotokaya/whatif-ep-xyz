// Re-exported from the single asset module (M3) so existing importers
// (e.g. bannerStorage) keep working.
export { appendCacheBust } from '@/lib/asset';

const DATA_URL_PREFIX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/;
const PUBLIC_OBJECT_PATH_SEGMENT = '/storage/v1/object/public/';

export const getExtensionFromMime = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'bin';
};

export const isDataUrlImage = (src: string): boolean => {
  return DATA_URL_PREFIX.test(src);
};

export const dataUrlToBlob = (dataUrl: string): { blob: Blob; mimeType: string; extension: string } => {
  const match = dataUrl.match(DATA_URL_PREFIX);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  const mimeType = match[1];
  const base64 = dataUrl.replace(DATA_URL_PREFIX, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return { blob, mimeType, extension: getExtensionFromMime(mimeType) };
};

export const extractStoragePathFromPublicUrl = (
  publicUrl: string,
  bucket: string
): string | null => {
  try {
    const url = new URL(publicUrl);
    const objectPathIndex = url.pathname.indexOf(PUBLIC_OBJECT_PATH_SEGMENT);
    if (objectPathIndex === -1) {
      return null;
    }

    const objectPath = url.pathname.slice(objectPathIndex + PUBLIC_OBJECT_PATH_SEGMENT.length);
    if (!objectPath.startsWith(`${bucket}/`)) {
      return null;
    }

    const encodedStoragePath = objectPath.slice(bucket.length + 1);
    return encodedStoragePath
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
};

export const removeFilesFromBucket = async (bucket: string, filePaths: string[]): Promise<string[]> => {
  const uniquePaths = [...new Set(filePaths.filter(Boolean))];
  if (uniquePaths.length === 0) return [];

  const response = await fetch('/api/editor/assets/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      backend: 'supabase',
      bucket,
      paths: uniquePaths,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; detail?: string }
    | null;

  if (!response.ok || payload?.error) {
    const detail = payload?.detail || payload?.error || `status_${response.status}`;
    throw new Error(`Storage remove failed: ${detail}`);
  }

  return Array.isArray((payload as { deleted?: unknown[] } | null)?.deleted)
    ? ((payload as { deleted?: string[] }).deleted ?? [])
    : [];
};
