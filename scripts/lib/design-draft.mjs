import { createHash, randomUUID } from 'node:crypto';

// Layered design drafts written by an AI on behalf of a signed-in user.
// Everything here runs with the user's own Supabase session (RLS + the
// `auth.uid()` revision RPCs + the user-scoped r2-presign function), exactly
// like the editor. No service role, raw SQL, or schema change.
// Spec: docs/DESIGN_CLI.md. Revision model: docs/adr/0001-revisioned-banner-previews.md.

export const ASSET_ORIGIN = 'https://assets.whatif-ep.xyz';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHAPES = new Set(['rectangle', 'triangle', 'star', 'circle', 'heart']);
const MAX_SIDE = 8000;

export class RevisionConflictError extends Error {
  constructor(expected, current) {
    super(`Revision conflict: expected document_revision ${expected}, current is ${current ?? 'unknown'}. Re-fetch with "get", re-apply your change on top of it, and retry.`);
    this.name = 'RevisionConflictError';
    this.expected = expected;
    this.current = current;
  }
}

const result = async (request) => {
  const { data, error } = await request;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
};

// RFC 4122 v5: the same (namespace, name) always yields the same id, so a
// retried "create" finds the draft it already made instead of duplicating it.
export function uuidV5(name, namespace) {
  if (!UUID.test(namespace)) throw new Error('uuidV5 namespace must be a UUID.');
  const hash = createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(String(name), 'utf8')
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const draftIdFor = (userId, key) => uuidV5(`design-draft:${key}`, userId);
export const uploadIdFor = (userId, sha256) => uuidV5(`upload:${sha256}`, userId);

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const positive = (value) => finite(value) && value > 0;

// Structural check of the editor document (types/template.ts). The editor
// itself stores elements unvalidated, so reject what it could not render
// before it is written rather than after a human opens it.
export function validateDocument(doc, { allowLocalFiles = false } = {}) {
  const errors = [];
  const t = doc?.template;
  if (!t || !Number.isInteger(t.width) || !Number.isInteger(t.height) || t.width <= 0 || t.height <= 0
    || t.width > MAX_SIDE || t.height > MAX_SIDE) {
    errors.push(`template.width/height must be integers in 1..${MAX_SIDE}.`);
  }
  if (typeof doc?.canvasColor !== 'string' || !doc.canvasColor) errors.push('canvasColor is required.');
  if (!Array.isArray(doc?.elements)) {
    errors.push('elements must be an array (index 0 = back, last = front).');
    return errors;
  }
  const ids = new Set();
  doc.elements.forEach((el, i) => {
    const at = `elements[${i}]`;
    if (typeof el?.id !== 'string' || !el.id) errors.push(`${at}.id is required.`);
    else if (ids.has(el.id)) errors.push(`${at}.id "${el.id}" is duplicated.`);
    else ids.add(el.id);
    if (!finite(el?.x) || !finite(el?.y)) errors.push(`${at}.x/y must be finite numbers.`);
    for (const key of ['rotation', 'opacity']) {
      if (el?.[key] !== undefined && !finite(el[key])) errors.push(`${at}.${key} must be a number.`);
    }
    if (el?.type === 'image') {
      if (typeof el.src !== 'string' || !el.src) errors.push(`${at}.src is required.`);
      else if (/^(data|blob):/.test(el.src)) errors.push(`${at}.src must be an asset key or URL, not ${el.src.slice(0, 5)}.`);
      else if (el.src.startsWith('file:') && !allowLocalFiles) errors.push(`${at}.src local file was not uploaded.`);
      if (!positive(el.width) || !positive(el.height)) errors.push(`${at}.width/height must be positive.`);
    } else if (el?.type === 'text') {
      if (typeof el.text !== 'string') errors.push(`${at}.text must be a string.`);
      if (!positive(el.fontSize)) errors.push(`${at}.fontSize must be positive.`);
      if (typeof el.fontFamily !== 'string' || !el.fontFamily) errors.push(`${at}.fontFamily is required.`);
      if (!finite(el.fontWeight)) errors.push(`${at}.fontWeight must be a number.`);
      if (typeof el.fill !== 'string') errors.push(`${at}.fill must be a color string.`);
    } else if (el?.type === 'shape') {
      if (!SHAPES.has(el.shapeType)) errors.push(`${at}.shapeType must be one of ${[...SHAPES].join(', ')}.`);
      if (!positive(el.width) || !positive(el.height)) errors.push(`${at}.width/height must be positive.`);
    } else {
      errors.push(`${at}.type must be image, text or shape.`);
    }
  });
  return errors;
}

export function assertValidDocument(doc, options) {
  const errors = validateDocument(doc, options);
  if (errors.length) throw new Error(`Invalid design document:\n- ${errors.join('\n- ')}`);
}

export const localFileOf = (src) => (typeof src === 'string' && src.startsWith('file:') ? decodeURIComponent(src.replace(/^file:(\/\/)?/, '')) : null);

export function layerSummary(elements) {
  return elements.map((el, index) => ({
    index, id: el.id, type: el.type,
    ...(el.type === 'text' ? { text: el.text, fontFamily: el.fontFamily, fontSize: el.fontSize } : {}),
    ...(el.type === 'image' ? { src: el.src } : {}),
    x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0, opacity: el.opacity ?? 1,
  }));
}

export function previewState(row) {
  const fresh = row.preview_status === 'ready' && row.preview_revision === row.document_revision && Boolean(row.fullres_key);
  return {
    documentRevision: row.document_revision,
    previewRevision: row.preview_revision,
    previewStatus: row.preview_status,
    previewError: row.preview_error ?? null,
    fullres: fresh ? 'ready' : row.preview_status === 'failed' ? 'failed' : row.fullres_key ? 'stale' : 'missing',
    fullresUrl: row.fullres_key ? `${ASSET_ORIGIN}/${row.fullres_key}` : null,
    thumbnailUrl: row.thumbnail_key ? `${ASSET_ORIGIN}/${row.thumbnail_key}` : null,
  };
}

export function toEditableDocument(row) {
  return {
    id: row.id, name: row.name, documentRevision: row.document_revision,
    template: row.template, canvasColor: row.canvas_color, elements: row.elements,
  };
}

export async function requireUser(supabase, accessToken) {
  const auth = await supabase.auth.getUser(accessToken);
  if (auth.error || !auth.data.user) throw new Error('A valid WHATIF user session is required. Run "npm run design -- login".');
  return auth.data.user;
}

// Same user-scoped presign + PUT as the editor (utils/r2Upload.ts).
export async function putObject({ supabase, key, bytes, contentType, fetchImpl = fetch }) {
  const signed = await result(supabase.functions.invoke('r2-presign', { body: { key, contentType } }));
  if (!signed?.url || !signed.url.startsWith('https://')) throw new Error('Invalid R2 presign response.');
  const response = await fetchImpl(signed.url, {
    method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes, signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status}) for ${key}.`);
}

async function deleteObjects({ supabase, keys }) {
  if (keys.length === 0) return;
  await result(supabase.functions.invoke('r2-presign', { body: { op: 'delete', keys } }));
}

// Register a local file as the user's upload, mirroring ImageLibraryModal:
// original + 400px JPEG thumbnail under user-images/{uid}/uploads/, plus a
// user_images row so it appears in the editor's Uploads tab. The asset id is
// derived from the content hash, so re-running never duplicates it.
export async function registerUpload({ supabase, userId, file, work = null, role = 'general', fetchImpl = fetch }) {
  const assetId = uploadIdFor(userId, file.sha256);
  const storagePath = `user-images/${userId}/uploads/${assetId}.${file.ext}`;
  const thumbnailPath = `user-images/${userId}/uploads/${assetId}.thumb.jpg`;
  const existing = await result(supabase.from('user_images').select('id, storage_path, width, height').eq('storage_path', storagePath).maybeSingle());
  if (!existing) {
    await putObject({ supabase, key: storagePath, bytes: file.bytes, contentType: file.contentType, fetchImpl });
    await putObject({ supabase, key: thumbnailPath, bytes: file.thumbnail, contentType: 'image/jpeg', fetchImpl });
    const { error } = await supabase.from('user_images').insert({
      user_id: userId, name: file.name, storage_path: storagePath, thumbnail_path: thumbnailPath,
      width: Math.round(file.width), height: Math.round(file.height), file_size: file.bytes.length,
      asset_scope: 'user', source_context: 'automation', asset_role: role,
      work_series_slug: work?.series ?? null, work_number: work?.number ?? null, variant_number: work?.variant ?? null,
      tags: [], notes: `Registered by scripts/design.mjs from ${file.name} (sha256 ${file.sha256}).`,
    });
    // 23505 = a concurrent run registered the same content first.
    if (error && error.code !== '23505') throw new Error(error.message);
  }
  return { key: storagePath, thumbnailKey: thumbnailPath, width: file.width, height: file.height, reused: Boolean(existing) };
}

export async function readOwnedBanner(supabase, userId, id) {
  if (!UUID.test(id)) throw new Error('A design UUID is required.');
  const row = await result(supabase.from('banners').select('*').eq('id', id).eq('user_id', userId).maybeSingle());
  if (!row) throw new Error('Design not found in your account (RLS hides designs you do not own).');
  if (!Number.isSafeInteger(row.document_revision)) throw new Error('Revision columns are missing. Stop and check the configured project.');
  return row;
}

// Idempotent by `id`: an existing draft is returned unchanged, never replaced.
export async function createDraft({ supabase, userId, id, name, doc }) {
  assertValidDocument(doc);
  const existing = await result(supabase.from('banners').select('*').eq('id', id).maybeSingle());
  if (existing) {
    if (existing.user_id !== userId) throw new Error('Draft id collision with another account.');
    return { created: false, row: existing };
  }
  // Same ordering as bannerStorage.duplicate: newest design first in My Designs.
  await result(supabase.rpc('increment_display_orders', { p_user_id: userId }));
  const { data, error } = await supabase.from('banners').insert({
    id, user_id: userId, name, template: doc.template, elements: doc.elements,
    canvas_color: doc.canvasColor, display_order: 1,
  }).select().single();
  if (error?.code === '23505') return { created: false, row: await readOwnedBanner(supabase, userId, id) };
  if (error) throw new Error(error.message);
  return { created: true, row: data };
}

// Compare-and-swap on document_revision. Same column effects as the
// save_banner_document RPC, but the WHERE clause also pins the revision the
// caller read, so a human's newer save is detected instead of overwritten.
export async function updateDocument({ supabase, userId, id, expectedRevision, doc, name, now = () => new Date().toISOString() }) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('documentRevision from "get" is required.');
  assertValidDocument(doc);
  const at = now();
  const rows = await result(supabase.from('banners').update({
    ...(name ? { name } : {}),
    template: doc.template, elements: doc.elements, canvas_color: doc.canvasColor,
    document_revision: expectedRevision + 1, preview_status: 'pending', preview_error: null,
    preview_requested_at: at, updated_at: at,
  }).eq('id', id).eq('user_id', userId).eq('document_revision', expectedRevision).select());
  if (rows.length === 1) return rows[0];
  const current = await result(supabase.from('banners').select('document_revision').eq('id', id).eq('user_id', userId).maybeSingle());
  throw new RevisionConflictError(expectedRevision, current?.document_revision);
}

// The editor's batchSave preview protocol (bannerStorage.ts): immutable keys
// per revision, finalize only if the document did not move on meanwhile,
// fail_banner_preview on error, then drop the previews it replaced.
export async function commitPreview({ supabase, userId, row, rendered, fetchImpl = fetch }) {
  const revision = row.document_revision;
  const assetRevision = `${revision}-${randomUUID()}`;
  const prefix = `user-images/${userId}/banners/${row.id}`;
  const thumbKey = `${prefix}/thumb/${assetRevision}.jpg`;
  const fullKey = `${prefix}/full/${assetRevision}.jpg`;
  try {
    await putObject({ supabase, key: thumbKey, bytes: rendered.thumbnail, contentType: 'image/jpeg', fetchImpl });
    await putObject({ supabase, key: fullKey, bytes: rendered.fullres, contentType: 'image/jpeg', fetchImpl });
    const finalized = await result(supabase.rpc('finalize_banner_preview', {
      p_banner_id: row.id, p_document_revision: revision, p_thumbnail_key: thumbKey, p_fullres_key: fullKey,
    }));
    if (!finalized?.length) {
      await deleteObjects({ supabase, keys: [thumbKey, fullKey] }).catch(() => undefined);
      return { committed: false, reason: 'superseded', row: await readOwnedBanner(supabase, userId, row.id) };
    }
    const replaced = [row.thumbnail_key, row.fullres_key]
      .filter((key) => typeof key === 'string' && key.startsWith(`${prefix}/`) && key !== thumbKey && key !== fullKey);
    await deleteObjects({ supabase, keys: replaced }).catch(() => undefined);
    return { committed: true, row: finalized[0] };
  } catch (error) {
    await supabase.rpc('fail_banner_preview', {
      p_banner_id: row.id, p_document_revision: revision, p_error: error instanceof Error ? error.message : 'Preview upload failed.',
    });
    throw error;
  }
}
