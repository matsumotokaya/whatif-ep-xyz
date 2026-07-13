import { describe, it, expect } from 'vitest';
import { migrateElements } from './elementMigration';
import type { CanvasElement, ShapeElement, TextElement, ImageElement } from '../types/template';

function baseShape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: 'shape-1',
    type: 'shape',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    shapeType: 'rectangle',
    fill: '#ffffff',
    fillEnabled: undefined as unknown as boolean,
    stroke: undefined as unknown as string,
    strokeWidth: undefined as unknown as number,
    strokeEnabled: undefined as unknown as boolean,
    ...overrides,
  };
}

function baseText(overrides: Partial<TextElement> & { strokeOnly?: boolean } = {}): TextElement {
  const { strokeOnly, ...rest } = overrides;
  const el: any = {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    text: 'hello',
    fontSize: 100,
    fontFamily: 'Arial',
    letterSpacing: undefined,
    fill: '#111111',
    fillEnabled: undefined,
    stroke: undefined,
    strokeWidth: undefined,
    strokeEnabled: undefined,
    fontWeight: 400,
    ...rest,
  };
  if (strokeOnly !== undefined) {
    el.strokeOnly = strokeOnly;
  }
  return el as TextElement;
}

function baseImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'image-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    src: 'https://example.com/a.png',
    visible: undefined as unknown as boolean,
    locked: undefined as unknown as boolean,
    ...overrides,
  };
}

describe('migrateElements', () => {
  it('fills in shape defaults when properties are missing', () => {
    const [result] = migrateElements([baseShape()]) as ShapeElement[];
    expect(result.fillEnabled).toBe(true);
    expect(result.stroke).toBe('#000000');
    expect(result.strokeWidth).toBe(2);
    expect(result.strokeEnabled).toBe(false);
    expect(result.visible).toBe(true);
    expect(result.locked).toBe(false);
  });

  it('does not overwrite existing shape stroke/fill properties', () => {
    const shape = baseShape({
      fillEnabled: false,
      stroke: '#ff0000',
      strokeWidth: 5,
      strokeEnabled: true,
      visible: false,
      locked: true,
    });
    const [result] = migrateElements([shape]) as ShapeElement[];
    expect(result.fillEnabled).toBe(false);
    expect(result.stroke).toBe('#ff0000');
    expect(result.strokeWidth).toBe(5);
    expect(result.strokeEnabled).toBe(true);
    expect(result.visible).toBe(false);
    expect(result.locked).toBe(true);
  });

  it('derives text fill/stroke from strokeOnly=true (stroke-only legacy text)', () => {
    const text = baseText({ strokeOnly: true });
    const [result] = migrateElements([text]) as TextElement[];
    expect(result.fillEnabled).toBe(false);
    expect(result.strokeEnabled).toBe(true);
    expect(result.stroke).toBe('#111111'); // falls back to fill since stroke is undefined
    expect(result.strokeWidth).toBe(Math.max(100 * 0.03, 2));
    expect(result.letterSpacing).toBe(0);
    expect(result.visible).toBe(true);
    expect(result.locked).toBe(false);
    // legacy property must be preserved, not deleted, per spec
    expect((result as any).strokeOnly).toBe(true);
  });

  it('derives text fill/stroke from strokeOnly=false', () => {
    const text = baseText({ strokeOnly: false });
    const [result] = migrateElements([text]) as TextElement[];
    expect(result.fillEnabled).toBe(true);
    expect(result.strokeEnabled).toBe(false);
    expect((result as any).strokeOnly).toBe(false);
  });

  it('defaults text fillEnabled to true when strokeOnly is undefined', () => {
    const text = baseText();
    const [result] = migrateElements([text]) as TextElement[];
    expect(result.fillEnabled).toBe(true);
    expect(result.strokeEnabled).toBe(false);
    expect((result as any).strokeOnly).toBeUndefined();
  });

  it('does not overwrite existing text fill/stroke/letterSpacing properties', () => {
    const text = baseText({
      strokeOnly: true,
      fillEnabled: true,
      stroke: '#00ff00',
      strokeWidth: 10,
      strokeEnabled: false,
      letterSpacing: 4,
      visible: false,
      locked: true,
    });
    const [result] = migrateElements([text]) as TextElement[];
    expect(result.fillEnabled).toBe(true);
    expect(result.stroke).toBe('#00ff00');
    expect(result.strokeWidth).toBe(10);
    expect(result.strokeEnabled).toBe(false);
    expect(result.letterSpacing).toBe(4);
    expect(result.visible).toBe(false);
    expect(result.locked).toBe(true);
  });

  it('fills in image defaults when properties are missing', () => {
    const [result] = migrateElements([baseImage()]) as ImageElement[];
    expect(result.visible).toBe(true);
    expect(result.locked).toBe(false);
  });

  it('does not overwrite existing image visible/locked properties', () => {
    const image = baseImage({ visible: false, locked: true });
    const [result] = migrateElements([image]) as ImageElement[];
    expect(result.visible).toBe(false);
    expect(result.locked).toBe(true);
  });

  it('is idempotent: migrating twice equals migrating once', () => {
    const elements: CanvasElement[] = [
      baseShape(),
      baseText({ strokeOnly: true }),
      baseText({ strokeOnly: false }),
      baseText(),
      baseImage(),
    ];
    const once = migrateElements(elements);
    const twice = migrateElements(once);
    expect(twice).toEqual(once);
  });

  it('returns an empty array for an empty input', () => {
    expect(migrateElements([])).toEqual([]);
  });
});
