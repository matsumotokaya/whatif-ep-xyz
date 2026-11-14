import { describe, expect, it, vi } from 'vitest';
import { executeBatch, patchDocument, validateBatch } from './design-batch.mjs';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = n => ({ id: id(n), name: 'Feed', document_revision: 4, canvas_color: '#fff', template: { width: 1080, height: 1350 }, elements: [
  { id: 'art', type: 'image', src: 'asset.png', x: 12, y: 34, width: 800, height: 900 },
  { id: 'credit', type: 'text', text: 'EP0473', x: 0, y: 0, fill: '#f00', fontSize: 55, fontWeight: 400, fontFamily: 'Arial' },
] });
const patch = { elements: [{ match: { type: 'text' }, count: 1, set: { fill: '#000', rotation: 90 } }] };
const manifest = () => ({ version: 1, jobs: [1, 2].map(n => ({ id: id(n), action: 'update', documentRevision: 4, patch })) });
function deps() {
  return { apply: true, read: vi.fn(async key => row(key === id(1) ? 1 : 2)), normalize: async x => x,
    render: vi.fn(async () => ({ fullres: Buffer.from('preview'), unresolvedFonts: [] })),
    update: vi.fn(async key => ({ ...row(key === id(1) ? 1 : 2), document_revision: 5 })),
    commit: vi.fn(async () => ({ committed: true })), report: vi.fn(async () => {}) };
}
describe('batch design preparation', () => {
  it('changes only selected fields and keeps artwork and episode text', () => {
    const original = row(1), next = patchDocument(original, patch);
    expect(next.elements[0]).toEqual(original.elements[0]);
    expect(next.elements[1]).toMatchObject({ text: 'EP0473', fill: '#000', rotation: 90 });
    expect(original.elements[1].fill).toBe('#f00');
  });
  it('rejects duplicate targets, publish and ambiguous selectors', () => {
    expect(() => validateBatch({ version: 1, jobs: [manifest().jobs[0], manifest().jobs[0]] })).toThrow('unique');
    expect(() => validateBatch({ version: 1, jobs: [{ ...manifest().jobs[0], action: 'publish' }] })).toThrow('publishing');
    expect(() => patchDocument(row(1), { elements: [{ match: { type: 'text' }, count: 2, set: { fill: '#000' } }] })).toThrow('expected 2');
  });
  it('dry run renders all jobs with no writes', async () => {
    const d = deps(); d.apply = false;
    expect((await executeBatch(manifest(), d)).phase).toBe('previewed');
    expect(d.render).toHaveBeenCalledTimes(2); expect(d.update).not.toHaveBeenCalled(); expect(d.commit).not.toHaveBeenCalled();
  });
  it('preflights every revision and render before the first write', async () => {
    const d = deps(); d.read.mockImplementation(async key => ({ ...row(1), id: key, document_revision: key === id(2) ? 8 : 4 }));
    expect((await executeBatch(manifest(), d)).error).toContain('revision conflict');
    expect(d.update).not.toHaveBeenCalled();
    const fonts = deps(); fonts.render.mockResolvedValueOnce({ unresolvedFonts: [] }).mockResolvedValueOnce({ unresolvedFonts: ['Missing'] });
    expect((await executeBatch(manifest(), fonts)).phase).toBe('failed'); expect(fonts.update).not.toHaveBeenCalled();
  });
  it('reuses preflight renders and commits the new revisions', async () => {
    const d = deps(); const result = await executeBatch(manifest(), d);
    expect(result.phase).toBe('complete'); expect(d.render).toHaveBeenCalledTimes(2);
    expect(d.commit.mock.calls.every(([r]) => r.document_revision === 5)).toBe(true);
    expect(result.jobs.map(j => j.status)).toEqual(['ready', 'ready']);
  });
  it('records partial success and stops after a commit conflict', async () => {
    const d = deps(); d.commit.mockResolvedValueOnce({ committed: true }).mockResolvedValueOnce({ committed: false, reason: 'stale' });
    const m = manifest(); m.jobs.push({ ...m.jobs[0], id: id(3) });
    const result = await executeBatch(m, d);
    expect(result.jobs.map(j => j.status)).toEqual(['ready', 'failed', 'prepared']);
    expect(result.jobs[1].documentRevision).toBe(5); expect(d.update).toHaveBeenCalledTimes(2);
  });
  it('render-only dry run does not commit; applied render does not edit documents', async () => {
    const m = { version: 1, jobs: [{ id: id(1), action: 'render', documentRevision: 4 }] };
    const d = deps(); d.apply = false; await executeBatch(m, d); expect(d.commit).not.toHaveBeenCalled();
    d.apply = true; await executeBatch(m, d); expect(d.update).not.toHaveBeenCalled(); expect(d.commit).toHaveBeenCalledTimes(1);
  });
});
