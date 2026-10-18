import { describe, expect, it, vi } from 'vitest';
import {
  RevisionConflictError, commitPreview, createDraft, draftIdFor, previewState, registerUpload,
  updateDocument, uuidV5, validateDocument,
} from './design-draft.mjs';

const USER = '9c1674eb-f053-4fe5-b99a-70805d2ccc59';
const ID = '00000000-0000-4000-8000-000000000001';
const doc = () => ({
  template: { id: 'size-1920x1080', name: 'x', width: 1920, height: 1080, backgroundColor: '#000' },
  canvasColor: '#000000',
  elements: [
    { id: 'bg', type: 'image', src: `user-images/${USER}/uploads/a.png`, x: 0, y: 0, width: 1920, height: 1080 },
    { id: 'title', type: 'text', text: 'まだ温かい', x: 100, y: 100, fontSize: 120, fontFamily: '"Noto Serif JP", serif', fontWeight: 900, fill: '#fff', letterSpacing: 0 },
  ],
});

// Minimal PostgREST-shaped fake: records every call, answers from `respond`.
function fakeSupabase(respond) {
  const calls = [];
  const from = (table) => {
    const call = { table, op: 'select', filters: {}, payload: null };
    calls.push(call);
    const settle = () => Promise.resolve(respond(call));
    const q = {
      select: () => q, insert: (p) => { call.op = 'insert'; call.payload = p; return q; },
      update: (p) => { call.op = 'update'; call.payload = p; return q; },
      eq: (k, v) => { call.filters[k] = v; return q; },
      single: settle, maybeSingle: settle, then: (res, rej) => settle().then(res, rej),
    };
    return q;
  };
  const rpc = vi.fn(async (name, args) => { const call = { rpc: name, args }; calls.push(call); return respond(call); });
  const invoke = vi.fn(async (name, { body }) => { calls.push({ fn: name, body }); return { data: body.op === 'delete' ? { deleted: body.keys } : { url: `https://r2.example/${body.key}` } }; });
  return { calls, client: { from, rpc, functions: { invoke } } };
}
const okFetch = vi.fn(async () => ({ ok: true, status: 200 }));

describe('uuidV5', () => {
  it('matches the RFC 4122 reference vector', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });
  it('gives a stable draft id per user and key', () => {
    expect(draftIdFor(USER, 'ep0402-youtube')).toBe(draftIdFor(USER, 'ep0402-youtube'));
    expect(draftIdFor(USER, 'ep0402-youtube')).not.toBe(draftIdFor(ID, 'ep0402-youtube'));
  });
});

describe('validateDocument', () => {
  it('accepts an editor document', () => expect(validateDocument(doc())).toEqual([]));
  it('rejects inline data, duplicates and unknown types', () => {
    const bad = doc();
    bad.elements.push({ ...bad.elements[0] }, { id: 'z', type: 'video', x: 0, y: 0 });
    bad.elements[0] = { ...bad.elements[0], src: 'data:image/png;base64,AAAA' };
    const errors = validateDocument(bad).join('\n');
    expect(errors).toMatch(/not data:/);
    expect(errors).toMatch(/duplicated/);
    expect(errors).toMatch(/image, text or shape/);
  });
  it('only lets local files through before upload', () => {
    const local = doc();
    local.elements[0].src = 'file:./bg.png';
    expect(validateDocument(local).join()).toMatch(/not uploaded/);
    expect(validateDocument(local, { allowLocalFiles: true })).toEqual([]);
  });
});

describe('createDraft', () => {
  it('returns an existing draft unchanged instead of inserting again', async () => {
    const existing = { id: ID, user_id: USER, document_revision: 3 };
    const { calls, client } = fakeSupabase((call) => (call.table === 'banners' ? { data: existing } : { data: null }));
    const out = await createDraft({ supabase: client, userId: USER, id: ID, name: 'n', doc: doc() });
    expect(out).toEqual({ created: false, row: existing });
    expect(calls.some((c) => c.op === 'insert' || c.rpc)).toBe(false);
  });
  it('inserts with the caller-derived id at the top of My Designs', async () => {
    const { calls, client } = fakeSupabase((call) => (call.op === 'insert' ? { data: { id: ID, document_revision: 1 } } : { data: null }));
    const out = await createDraft({ supabase: client, userId: USER, id: ID, name: 'n', doc: doc() });
    expect(out.created).toBe(true);
    expect(calls.find((c) => c.rpc)?.rpc).toBe('increment_display_orders');
    expect(calls.find((c) => c.op === 'insert').payload).toMatchObject({ id: ID, user_id: USER, display_order: 1, canvas_color: '#000000' });
  });
});

describe('updateDocument', () => {
  it('pins the expected revision and bumps it like save_banner_document', async () => {
    const { calls, client } = fakeSupabase((call) => (call.op === 'update' ? { data: [{ id: ID, document_revision: 5 }] } : { data: null }));
    await updateDocument({ supabase: client, userId: USER, id: ID, expectedRevision: 4, doc: doc(), now: () => 'T' });
    const update = calls.find((c) => c.op === 'update');
    expect(update.filters).toEqual({ id: ID, user_id: USER, document_revision: 4 });
    expect(update.payload).toMatchObject({ document_revision: 5, preview_status: 'pending', preview_error: null, updated_at: 'T', preview_requested_at: 'T' });
  });
  it('reports a conflict when a human saved in between', async () => {
    const { client } = fakeSupabase((call) => (call.op === 'update' ? { data: [] } : { data: { document_revision: 7 } }));
    const attempt = updateDocument({ supabase: client, userId: USER, id: ID, expectedRevision: 4, doc: doc() });
    await expect(attempt).rejects.toBeInstanceOf(RevisionConflictError);
    await expect(attempt).rejects.toMatchObject({ expected: 4, current: 7 });
  });
});

describe('registerUpload', () => {
  const file = { name: 'bg.png', ext: 'png', contentType: 'image/png', bytes: Buffer.from('png'), thumbnail: Buffer.from('jpg'), width: 1672.4, height: 941, sha256: 'abc' };
  it('skips upload and insert when the same content is already registered', async () => {
    const { calls, client } = fakeSupabase(() => ({ data: { id: 'x' } }));
    const out = await registerUpload({ supabase: client, userId: USER, file, fetchImpl: okFetch });
    expect(out.reused).toBe(true);
    expect(calls.some((c) => c.fn || c.op === 'insert')).toBe(false);
  });
  it('uploads into the user namespace and records integer dimensions', async () => {
    const { calls, client } = fakeSupabase((call) => (call.op === 'insert' ? { error: null } : { data: null }));
    const out = await registerUpload({ supabase: client, userId: USER, file, role: 'background', fetchImpl: okFetch });
    expect(out.key).toMatch(new RegExp(`^user-images/${USER}/uploads/[0-9a-f-]{36}\\.png$`));
    expect(calls.filter((c) => c.fn).map((c) => c.body.key)).toEqual([out.key, out.thumbnailKey]);
    expect(calls.find((c) => c.op === 'insert').payload).toMatchObject({ width: 1672, source_context: 'automation', asset_role: 'background' });
  });
});

describe('commitPreview', () => {
  const row = { id: ID, document_revision: 2, thumbnail_key: `user-images/${USER}/banners/${ID}/thumb/1-old.jpg`, fullres_key: `user-images/${USER}/banners/${ID}/full/1-old.jpg` };
  const rendered = { thumbnail: Buffer.from('t'), fullres: Buffer.from('f') };
  it('finalizes the rendered revision and removes the previews it replaced', async () => {
    const { calls, client } = fakeSupabase((call) => (call.rpc === 'finalize_banner_preview' ? { data: [{ ...row, preview_status: 'ready' }] } : { data: null }));
    const out = await commitPreview({ supabase: client, userId: USER, row, rendered, fetchImpl: okFetch });
    expect(out.committed).toBe(true);
    expect(calls.find((c) => c.rpc).args.p_document_revision).toBe(2);
    expect(calls.find((c) => c.body?.op === 'delete').body.keys).toEqual([row.thumbnail_key, row.fullres_key]);
  });
  it('discards its own upload when a newer revision won', async () => {
    const { calls, client } = fakeSupabase((call) => (call.rpc ? { data: [] } : { data: { ...row, document_revision: 3, user_id: USER } }));
    const out = await commitPreview({ supabase: client, userId: USER, row, rendered, fetchImpl: okFetch });
    expect(out).toMatchObject({ committed: false, reason: 'superseded' });
    const deleted = calls.find((c) => c.body?.op === 'delete').body.keys;
    expect(deleted.every((key) => key.startsWith(`user-images/${USER}/banners/${ID}/`) && key.includes('/2-'))).toBe(true);
  });
  it('marks the preview failed when an upload fails', async () => {
    const { calls, client } = fakeSupabase(() => ({ data: null }));
    const failing = vi.fn(async () => ({ ok: false, status: 500 }));
    await expect(commitPreview({ supabase: client, userId: USER, row, rendered, fetchImpl: failing })).rejects.toThrow(/R2 upload failed/);
    expect(calls.find((c) => c.rpc)?.rpc).toBe('fail_banner_preview');
  });
});

describe('previewState', () => {
  it('distinguishes ready, stale, failed and missing', () => {
    const base = { document_revision: 3, preview_revision: 3, preview_status: 'ready', fullres_key: 'k' };
    expect(previewState(base).fullres).toBe('ready');
    expect(previewState({ ...base, document_revision: 4, preview_status: 'pending' }).fullres).toBe('stale');
    expect(previewState({ ...base, preview_status: 'failed' }).fullres).toBe('failed');
    expect(previewState({ ...base, fullres_key: null }).fullres).toBe('missing');
  });
});
