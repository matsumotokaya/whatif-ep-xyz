import { describe, it, expect } from 'vitest';
import {
  CASCADE_OFFSET,
  INITIAL_TEXT_DEFAULTS,
  cascadePosition,
  cloneElements,
  createImageElement,
  createShapeElement,
  createTextElement,
  elementsFromTemplate,
  fitNewImageSize,
} from './elementFactory';
import type { CanvasElement, ShapeElement } from '../types/template';

const canvas = { width: 1000, height: 2000 };

const shape = (id: string, x: number, y: number, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  x,
  y,
  width: 100,
  height: 100,
  shapeType: 'rectangle',
  fill: '#000000',
  fillEnabled: true,
  stroke: '#000000',
  strokeWidth: 2,
  strokeEnabled: false,
  ...overrides,
});

describe('fitNewImageSize', () => {
  it('keeps the natural size of an image that already fits', () => {
    expect(fitNewImageSize(400, 300, canvas)).toEqual({ width: 400, height: 300 });
  });

  it('scales a larger image down to 80% of the artboard, keeping its aspect ratio', () => {
    // Width is the limiting side: 4000 -> 800.
    expect(fitNewImageSize(4000, 3000, canvas)).toEqual({ width: 800, height: 600 });
    // Height is the limiting side: 8000 -> 1600.
    expect(fitNewImageSize(1000, 8000, canvas)).toEqual({ width: 200, height: 1600 });
  });

  it('never scales an image up', () => {
    expect(fitNewImageSize(10, 10, canvas)).toEqual({ width: 10, height: 10 });
  });

  it('returns a usable size for unusable input', () => {
    expect(fitNewImageSize(0, 0, canvas)).toEqual({ width: 1, height: 1 });
    expect(fitNewImageSize(Number.NaN, 50, canvas)).toEqual({ width: 1, height: 50 });
  });
});

describe('createImageElement', () => {
  it('centers a new image on the artboard', () => {
    const element = createImageElement('image-1', 'key.png', { width: 400, height: 300 }, canvas, []);
    expect(element).toMatchObject({ id: 'image-1', type: 'image', src: 'key.png', x: 300, y: 850, width: 400, height: 300 });
  });

  it('centers on the drop point when one is given', () => {
    const element = createImageElement('image-1', 'key.png', { width: 400, height: 300 }, canvas, [], { x: 200, y: 150 });
    expect(element.x).toBe(0);
    expect(element.y).toBe(0);
  });

  it('offsets an image that would land exactly on an existing element', () => {
    const first = createImageElement('image-1', 'a.png', { width: 400, height: 300 }, canvas, []);
    const second = createImageElement('image-2', 'b.png', { width: 400, height: 300 }, canvas, [first]);
    expect(second.x).toBe(first.x + CASCADE_OFFSET);
    expect(second.y).toBe(first.y + CASCADE_OFFSET);
  });
});

describe('createShapeElement', () => {
  it('sizes a shape from the shorter artboard side and centers it', () => {
    const circle = createShapeElement('shape-1', 'circle', canvas, []);
    expect(circle).toMatchObject({ width: 250, height: 250, x: 375, y: 875, shapeType: 'circle' });
  });

  it('makes rectangles wider than tall', () => {
    const rectangle = createShapeElement('shape-1', 'rectangle', canvas, []);
    expect(rectangle.width).toBe(333);
    expect(rectangle.height).toBe(250);
  });
});

describe('createTextElement', () => {
  it('applies the sticky text defaults at the given position', () => {
    const text = createTextElement('text-1', 'Hello', { x: 10, y: 20 }, { ...INITIAL_TEXT_DEFAULTS, fontSize: 120, fill: '#ff0000' });
    expect(text).toMatchObject({ id: 'text-1', text: 'Hello', x: 10, y: 20, fontSize: 120, fill: '#ff0000', fontFamily: 'Arial' });
  });
});

describe('cascadePosition', () => {
  it('returns the position unchanged when it is free', () => {
    expect(cascadePosition({ x: 5, y: 5 }, [shape('a', 100, 100)])).toEqual({ x: 5, y: 5 });
  });

  it('steps past every occupied position', () => {
    const existing: CanvasElement[] = [shape('a', 0, 0), shape('b', CASCADE_OFFSET, CASCADE_OFFSET)];
    expect(cascadePosition({ x: 0, y: 0 }, existing)).toEqual({ x: CASCADE_OFFSET * 2, y: CASCADE_OFFSET * 2 });
  });
});

describe('cloneElements', () => {
  it('creates independent, unlocked copies with fresh ids and an offset', () => {
    const original = shape('a', 10, 20, { locked: true });
    let counter = 0;
    const [copy] = cloneElements([original], 40, (type) => `${type}-copy-${++counter}`);

    expect(copy).not.toBe(original);
    expect(copy.id).toBe('shape-copy-1');
    expect(copy).toMatchObject({ x: 50, y: 60, locked: false, width: 100 });
    expect(original).toMatchObject({ id: 'a', x: 10, y: 20, locked: true });
  });

  it('keeps the order of the copied elements', () => {
    let counter = 0;
    const copies = cloneElements([shape('a', 0, 0), shape('b', 5, 5)], 0, () => `id-${++counter}`);
    expect(copies.map((el) => el.x)).toEqual([0, 5]);
    expect(copies.map((el) => el.id)).toEqual(['id-1', 'id-2']);
  });
});

describe('elementsFromTemplate', () => {
  it('unlocks every element and does not share objects with the template', () => {
    const template = [
      { id: 'a', type: 'image', x: 0, y: 0, width: 10, height: 10, src: 's', locked: true },
      { id: 'b', type: 'text', x: 0, y: 0, text: 't', locked: false },
    ] as unknown as CanvasElement[];
    const copied = elementsFromTemplate(template);
    expect(copied.map((element) => element.locked)).toEqual([false, false]);
    expect(template[0].locked).toBe(true);
    expect(copied[0]).not.toBe(template[0]);
    expect(elementsFromTemplate(undefined)).toEqual([]);
  });
});
