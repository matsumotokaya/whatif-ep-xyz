import { describe, it, expect } from 'vitest';
import { buildGuestInitialDocument, buildMemberInitialDocument } from './editorBootstrap';
import type { EditorRecoverySnapshot } from './editorRecovery';
import type { Banner, CanvasElement, ShapeElement } from '../types/template';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  shapeType: 'rectangle',
  fill: '#ffffff',
  fillEnabled: true,
  stroke: '#000000',
  strokeWidth: 2,
  strokeEnabled: false,
  visible: true,
  locked: false,
  ...overrides,
});

function banner(elements: CanvasElement[], updatedAt = '2026-11-01T00:00:00.000Z'): Pick<Banner, 'elements' | 'canvasColor' | 'updatedAt' | 'template'> {
  return {
    elements,
    canvasColor: '#eeeeee',
    updatedAt,
    template: { id: 't', name: 'T', width: 1000, height: 800, backgroundColor: '#ffffff' },
  };
}

function recovery(elements: CanvasElement[], updatedAt: string): EditorRecoverySnapshot {
  return { version: 1, userId: 'u', bannerId: 'b', elements, canvasColor: '#123456', updatedAt };
}

const createId = () => 'text-new';

describe('buildMemberInitialDocument', () => {
  it('opens the stored document untouched when nothing needs fixing', () => {
    const stored = [shape('a')];
    const initial = buildMemberInitialDocument(banner(stored), null, createId);
    expect(initial.elements).toEqual(stored);
    expect(initial.canvasColor).toBe('#eeeeee');
    expect(initial.needsSave).toBe(false);
    expect(initial.discardRecovery).toBe(false);
  });

  it('restores a recovery snapshot that is newer than the stored document', () => {
    const local = [shape('a', { x: 500 })];
    const initial = buildMemberInitialDocument(banner([shape('a')]), recovery(local, '2026-11-02T00:00:00.000Z'), createId);
    expect(initial.elements).toEqual(local);
    expect(initial.canvasColor).toBe('#123456');
    expect(initial.needsSave).toBe(true);
    expect(initial.discardRecovery).toBe(false);
  });

  it('ignores and discards a recovery snapshot that is not newer', () => {
    const stored = [shape('a')];
    const initial = buildMemberInitialDocument(
      banner(stored),
      recovery([shape('a', { x: 500 })], '2026-10-31T00:00:00.000Z'),
      createId,
    );
    expect(initial.elements).toEqual(stored);
    expect(initial.needsSave).toBe(false);
    expect(initial.discardRecovery).toBe(true);
  });

  it('ignores a recovery snapshot with an unreadable timestamp', () => {
    const initial = buildMemberInitialDocument(banner([shape('a')]), recovery([shape('z')], 'not a date'), createId);
    expect(initial.elements.map((el) => el.id)).toEqual(['a']);
    expect(initial.discardRecovery).toBe(true);
  });

  it('saves immediately when legacy data had to be normalised', () => {
    // A legacy shape without the fill/stroke flags.
    const legacy = { id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10, shapeType: 'rectangle', fill: '#fff' } as unknown as CanvasElement;
    const initial = buildMemberInitialDocument(banner([legacy]), null, createId);
    expect(initial.needsSave).toBe(true);
    expect(initial.elements[0]).toMatchObject({ fillEnabled: true, strokeEnabled: false, visible: true, locked: false });
  });

  it('seeds an empty design with a starter text centered on the artboard and saves it', () => {
    const initial = buildMemberInitialDocument(banner([]), null, createId);
    expect(initial.needsSave).toBe(true);
    expect(initial.elements).toHaveLength(1);
    expect(initial.elements[0]).toMatchObject({ id: 'text-new', type: 'text', x: 300, y: 290, align: 'center' });
  });
});

describe('buildGuestInitialDocument', () => {
  it('normalises the elements and never asks for an immediate save', () => {
    const legacy = { id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10, shapeType: 'rectangle', fill: '#fff' } as unknown as CanvasElement;
    const initial = buildGuestInitialDocument([legacy], '#000000');
    expect(initial.elements[0]).toMatchObject({ fillEnabled: true, visible: true });
    expect(initial.canvasColor).toBe('#000000');
    expect(initial.needsSave).toBe(false);
  });

  it('falls back to an empty white canvas for missing data', () => {
    expect(buildGuestInitialDocument(undefined, undefined)).toMatchObject({ elements: [], canvasColor: '#FFFFFF' });
  });
});
