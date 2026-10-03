import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { preparePackage, loadPackage, checkRatio } from './wallpaper-package.mjs';
import { assertDraft, replacement, alreadyImported, importDraft } from './wallpaper-import.mjs';

const dirs = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function fixture(wrongLandscape = false) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'whatif-wallpaper-'));
  dirs.push(dir);
  for (const [slot, width, height] of [['portrait', 90, 160], ['landscape', wrongLandscape ? 90 : 160, wrongLandscape ? 160 : 90], ['feed', 80, 100]]) {
    await sharp({ create: { width, height, channels: 3, background: '#aabbcc' } }).png().toFile(path.join(dir, `${slot}.png`));
  }
  const manifest = { version: 1, series: 'episode', workNumber: 458, variant: 1,
    sources: { portrait: 'portrait.png', landscape: 'landscape.png', feed: 'feed.png' } };
  const manifestPath = path.join(dir, 'sources.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { dir, manifestPath, out: path.join(dir, 'package') };
}

describe('offline finished-art package', () => {
  it('rejects portrait in the landscape slot before writing outputs', async () => {
    const f = await fixture(true);
    await expect(preparePackage(f.manifestPath, f.out)).rejects.toThrow('landscape: expected');
    await expect(access(f.out)).rejects.toThrow();
  });
  it('does not silently crop an almost-correct aspect ratio', () => {
    expect(() => checkRatio('feed', 1080, 1349)).toThrow();
  });
  it('builds and validates three correctly sized masters, detecting later tampering', async () => {
    const f = await fixture();
    await preparePackage(f.manifestPath, f.out);
    const filename = path.join(f.out, 'package.json');
    const { pack, files } = await loadPackage(filename);
    expect(pack.assets.landscape.width).toBe(2560);
    expect(pack.assets.portrait.height).toBe(2560);
    expect((await sharp(files.feed.full).metadata()).height).toBe(1350);
    await expect(preparePackage(f.manifestPath, f.out)).rejects.toThrow();
    await writeFile(path.join(f.out, 'landscape.png'), await readFile(path.join(f.out, 'portrait.png')));
    await expect(loadPackage(filename)).rejects.toThrow('checksum');
  });
});

describe('draft-only registration guards', () => {
  const pack = { series: 'episode', workNumber: 458, variant: 1 };
  const project = { status: 'draft', created_by: 'user', project_type: 'variant_pack', work_series_slug: 'episode', work_number: 458, variant_number: 1 };
  it('refuses published targets, other owners, and wrong works', () => {
    expect(() => assertDraft(project, pack, 'user')).not.toThrow();
    for (const patch of [{ status: 'published' }, { created_by: 'other' }, { work_number: 459 }, { variant_number: 2 }]) {
      expect(() => assertDraft({ ...project, ...patch }, pack, 'user')).toThrow();
    }
  });
  it('retains template metadata but replaces all stale elements with the correctly sized image', () => {
    const next = replacement({ id: 'banner', template: { id: 'original', width: 10, height: 10 } }, 'landscape', { sha256: 'abc', thumbnailSha256: 'def' }, 'user');
    expect(next.template).toEqual({ id: 'original', width: 2560, height: 1440 });
    expect(next.elements).toHaveLength(1);
    const banner = { elements: next.elements, template: next.template, fullres_key: next.fullKey, thumbnail_key: next.thumbKey,
      document_revision: 2, preview_revision: 2, preview_status: 'ready' };
    expect(alreadyImported(banner, next)).toBe(true);
    expect(alreadyImported({ ...banner, preview_revision: 1 }, next)).toBe(false);
  });
  it('rejects a non-admin before reading projects or writing anything', async () => {
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
      from: (table) => {
        expect(table).toBe('profiles');
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'user' } }) }) }) };
      },
    };
    await expect(importDraft({ supabase, projectId: '00000000-0000-4000-8000-000000000001', pack, apply: true })).rejects.toThrow('Admin role');
  });
});
