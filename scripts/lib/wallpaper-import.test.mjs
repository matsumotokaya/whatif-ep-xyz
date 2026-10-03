import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importDraft } from './wallpaper-import.mjs';
import { SPECS } from './wallpaper-package.mjs';

const dirs = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
function fixture() {
  const projectId = '00000000-0000-4000-8000-000000000001';
  const project = { id: projectId, status: 'draft', created_by: 'user', project_type: 'variant_pack', work_series_slug: 'episode', work_number: 458, variant_number: 1 };
  const pack = { series: 'episode', workNumber: 458, variant: 1, assets: {} };
  const files = {};
  const banners = [];
  const links = [];
  for (const [slot, spec] of Object.entries(SPECS)) {
    pack.assets[slot] = { ...spec, sha256: slot, thumbnailSha256: slot, source: { filename: `${slot}.png` } };
    files[slot] = { full: Buffer.from('png'), thumb: Buffer.from('jpeg') };
    banners.push({ id: slot, user_id: 'user', document_revision: 1, updated_at: 'before', elements: [{ type: 'text' }], template: { id: slot } });
    links.push({ banner_id: slot, role: spec.role });
  }
  const events = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    from: (table) => {
      const filters = {};
      const query = {
        select: () => query, eq: (key, value) => { filters[key] = value; return query; }, in: () => query,
        single: async () => ({ data: table === 'profiles' ? { role: 'admin' } : table === 'production_projects' ? project : banners.find((b) => b.id === filters.id) }),
        then: (resolve) => Promise.resolve({ data: table === 'production_project_banners' ? links : banners }).then(resolve),
      };
      return query;
    },
    functions: { invoke: vi.fn(async () => ({ data: { url: 'https://example.com/signed' } })) },
    rpc: vi.fn((name, params) => ({ single: async () => {
      events.push(name);
      const row = banners.find((b) => b.id === params.p_banner_id);
      if (name === 'save_banner_document') {
        Object.assign(row, { elements: params.p_elements, template: params.p_template, document_revision: row.document_revision + 1, updated_at: 'after' });
      } else {
        Object.assign(row, { fullres_key: params.p_fullres_key, thumbnail_key: params.p_thumbnail_key, preview_status: 'ready', preview_revision: params.p_document_revision });
      }
      return { data: { ...row } };
    } })),
  };
  const fetchImpl = vi.fn(async () => { events.push('upload'); return { ok: true }; });
  return { supabase, projectId, project, pack, files, fetchImpl, events };
}
async function backup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'wallpaper-import-'));
  dirs.push(dir);
  return path.join(dir, 'before.json');
}

it('dry-run neither uploads nor mutates nor needs a backup', async () => {
  const f = fixture();
  const plan = await importDraft(f);
  expect(plan.applied).toBe(false);
  expect(plan.slots.map((s) => s.action)).toEqual(['replace', 'replace', 'replace']);
  expect(f.supabase.functions.invoke).not.toHaveBeenCalled();
  expect(f.supabase.rpc).not.toHaveBeenCalled();
});

it('backs up, uploads everything before writes, and skips a repeated import', async () => {
  const f = fixture();
  const backupPath = await backup();
  const output = await importDraft({ ...f, apply: true, backupPath });
  expect(output.applied).toBe(true);
  expect(f.events.slice(0, 6)).toEqual(Array(6).fill('upload'));
  expect(f.supabase.rpc).toHaveBeenCalledTimes(6);
  expect(JSON.parse(await readFile(backupPath, 'utf8')).banners[0].document_revision).toBe(1);
  expect(f.project.status).toBe('draft');
  f.supabase.rpc.mockClear();
  f.fetchImpl.mockClear();
  await importDraft({ ...f, apply: true, backupPath: await backup() });
  expect(f.supabase.rpc).not.toHaveBeenCalled();
  expect(f.fetchImpl).not.toHaveBeenCalled();
});

it('leaves all documents untouched if any upload fails', async () => {
  const f = fixture();
  f.fetchImpl.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 503 });
  await expect(importDraft({ ...f, apply: true, backupPath: await backup() })).rejects.toThrow('503');
  expect(f.supabase.rpc).not.toHaveBeenCalled();
});

it('rejects a missing role before the first upload', async () => {
  const f = fixture();
  const original = f.supabase.from;
  f.supabase.from = (table) => table === 'production_project_banners'
    ? { select() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: [] }).then(resolve); } }
    : original(table);
  await expect(importDraft({ ...f, apply: true, backupPath: await backup() })).rejects.toThrow('exactly one');
  expect(f.supabase.functions.invoke).not.toHaveBeenCalled();
});
