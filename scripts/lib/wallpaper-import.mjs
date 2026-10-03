import { writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { SPECS } from './wallpaper-package.mjs';

export const PROJECT_URL = 'https://rgqduwojvylkulhyodqg.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const result = async (request) => {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
};

export function assertDraft(project, pack, userId) {
  if (!project || project.status !== 'draft' || project.created_by !== userId
    || project.project_type !== 'variant_pack' || project.work_series_slug !== pack.series
    || project.work_number !== pack.workNumber || project.variant_number !== pack.variant) {
    throw new Error('Target must be your existing draft for the exact series/work/variant. Published projects are never replaced.');
  }
}

export function replacement(banner, slot, asset, userId) {
  const spec = SPECS[slot];
  const prefix = `user-images/${userId}/banners/${banner.id}`;
  const fullKey = `${prefix}/full/import-${asset.sha256}.png`;
  const thumbKey = `${prefix}/thumb/import-${asset.thumbnailSha256}.jpg`;
  return {
    fullKey, thumbKey,
    template: { ...banner.template, width: spec.width, height: spec.height },
    elements: [{ id: `import-${slot}-${asset.sha256.slice(0, 16)}`, type: 'image', src: fullKey,
      x: 0, y: 0, width: spec.width, height: spec.height, visible: true, opacity: 1 }],
  };
}

export function alreadyImported(banner, next) {
  return banner.fullres_key === next.fullKey && banner.thumbnail_key === next.thumbKey
    && banner.preview_status === 'ready' && banner.preview_revision === banner.document_revision
    && isDeepStrictEqual(banner.elements, next.elements)
    && banner.template?.width === next.template.width && banner.template?.height === next.template.height;
}

// Uses the same user-scoped presign + revision RPCs as the editor. No service
// role, raw SQL, schema change, canonical metadata write, delete, or publish.
export async function importDraft({ supabase, accessToken, projectId, pack, files, apply = false, backupPath, fetchImpl = fetch }) {
  if (!UUID.test(projectId)) throw new Error('An explicit project UUID is required.');
  const auth = await supabase.auth.getUser(accessToken);
  if (auth.error || !auth.data.user) throw new Error('A valid WHATIF admin user access token is required.');
  const userId = auth.data.user.id;
  const profile = await result(supabase.from('profiles').select('role').eq('id', userId).single());
  if (profile?.role !== 'admin') throw new Error('Admin role required.');
  const readProject = () => result(supabase.from('production_projects').select('*').eq('id', projectId).single());
  const project = await readProject();
  assertDraft(project, pack, userId);
  const links = await result(supabase.from('production_project_banners').select('*').eq('project_id', projectId).eq('is_active', true));
  const selected = Object.entries(SPECS).map(([slot, spec]) => {
    const matches = links.filter((link) => link.role === spec.role);
    if (matches.length !== 1) throw new Error(`Expected exactly one active ${spec.role} banner.`);
    return { slot, id: matches[0].banner_id };
  });
  if (new Set(selected.map((item) => item.id)).size !== 3) throw new Error('The three slots must reference different banners.');
  const banners = await result(supabase.from('banners').select('*').in('id', selected.map((item) => item.id)));
  const plan = selected.map(({ slot, id }) => {
    const banner = banners.find((item) => item.id === id);
    if (!banner || banner.user_id !== userId || !Number.isSafeInteger(banner.document_revision)) {
      throw new Error('Missing owned banner or revision RPC schema. Stop and check the configured project.');
    }
    const next = replacement(banner, slot, pack.assets[slot], userId);
    return { slot, banner, next, skip: alreadyImported(banner, next) };
  });
  const summary = { projectId, work: `${pack.series}/${pack.workNumber}/${pack.variant}`, applied: false,
    slots: plan.map(({ slot, banner, next, skip }) => ({ slot, bannerId: banner.id, width: next.template.width,
      height: next.template.height, source: pack.assets[slot].source?.filename, action: skip ? 'unchanged' : 'replace' })) };
  if (!apply) return summary;
  if (!backupPath) throw new Error('--backup is required with --apply.');
  // Save a recovery snapshot BEFORE uploading or writing. Never overwrite one.
  await writeFile(backupPath, JSON.stringify({ project, links, banners }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const changes = plan.filter((item) => !item.skip);
  // Finish every upload before replacing the first document. Immutable keys
  // keep previous previews available even if an upload or later RPC fails.
  for (const { slot, next } of changes) {
    for (const [key, bytes, contentType] of [[next.fullKey, files[slot].full, 'image/png'], [next.thumbKey, files[slot].thumb, 'image/jpeg']]) {
      const signed = await result(supabase.functions.invoke('r2-presign', { body: { key, contentType } }));
      if (!signed?.url || !signed.url.startsWith('https://')) throw new Error('Invalid R2 presign response.');
      const response = await fetchImpl(signed.url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`R2 upload failed (${response.status}). No further changes attempted.`);
    }
  }
  assertDraft(await readProject(), pack, userId);
  for (const { banner, next } of changes) {
    const current = await result(supabase.from('banners').select('document_revision, updated_at').eq('id', banner.id).single());
    if (current.document_revision !== banner.document_revision || current.updated_at !== banner.updated_at) {
      throw new Error('Banner changed during import. Stop editing/publishing this project and inspect the backup before retrying.');
    }
    const saved = await result(supabase.rpc('save_banner_document', {
      p_banner_id: banner.id, p_elements: next.elements, p_canvas_color: '#808080', p_template: next.template,
    }).single());
    const finalized = await result(supabase.rpc('finalize_banner_preview', {
      p_banner_id: banner.id, p_document_revision: saved.document_revision,
      p_thumbnail_key: next.thumbKey, p_fullres_key: next.fullKey,
    }).single());
    if (finalized.preview_status !== 'ready' || finalized.fullres_key !== next.fullKey) throw new Error('Preview finalization failed. Project remains unpublished.');
  }
  return { ...summary, applied: true, backupPath, next: 'Review all three previews in Content Factory, then use its existing Publish action.' };
}
