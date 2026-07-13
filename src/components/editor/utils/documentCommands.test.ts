import { describe, it, expect } from 'vitest';
import { applyCommand, type Command } from './documentCommands';
import type { CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    text: 'hello',
    fontSize: 40,
    fontFamily: 'Arial',
    letterSpacing: 0,
    fill: '#000000',
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    fontWeight: 400,
    ...overrides,
  };
}

function makeShape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: 'shape-1',
    type: 'shape',
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    shapeType: 'rectangle',
    fill: '#ffffff',
    fillEnabled: true,
    stroke: '#000000',
    strokeWidth: 2,
    strokeEnabled: false,
    ...overrides,
  };
}

function makeImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'image-1',
    type: 'image',
    x: 5,
    y: 5,
    width: 200,
    height: 200,
    src: 'https://example.com/a.png',
    ...overrides,
  };
}

// Snapshot helper: deep copy for pre/post comparison of "did the input get mutated".
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('applyCommand', () => {
  describe('updateElement', () => {
    it('merges updates into the matching text element (type matches)', () => {
      const text = makeText();
      const shape = makeShape();
      const elements: CanvasElement[] = [text, shape];
      const before = snapshot(elements);

      const cmd: Command = { type: 'updateElement', id: 'text-1', updates: { type: 'text', text: 'world' } };
      const result = applyCommand(elements, cmd);

      expect((result[0] as TextElement).text).toBe('world');
      expect(result[0]).not.toBe(text); // targeted element gets a new reference
      expect(result[1]).toBe(shape); // untouched element keeps reference equality

      // input untouched
      expect(elements).toEqual(before);
      expect(elements[0]).toBe(text);
    });

    it('merges updates without a type field via the generic branch', () => {
      const text = makeText();
      const elements: CanvasElement[] = [text];
      const cmd: Command = { type: 'updateElement', id: 'text-1', updates: { x: 99 } };
      const result = applyCommand(elements, cmd);

      expect(result[0].x).toBe(99);
      expect(result[0]).not.toBe(text);
    });

    it('does nothing when the id is not found (returns new array, same contents)', () => {
      const text = makeText();
      const elements: CanvasElement[] = [text];
      const cmd: Command = { type: 'updateElement', id: 'nonexistent', updates: { x: 99 } };
      const result = applyCommand(elements, cmd);

      expect(result).not.toBe(elements); // map always returns a new array
      expect(result).toEqual(elements);
      expect(result[0]).toBe(text); // element itself untouched
    });

    it('does not mutate the original element object', () => {
      const image = makeImage();
      const elements: CanvasElement[] = [image];
      applyCommand(elements, { type: 'updateElement', id: 'image-1', updates: { x: 500 } });
      expect(image.x).toBe(5); // original object untouched
    });
  });

  describe('updateElements', () => {
    it('applies updateFn only to targeted ids, preserving reference equality for others', () => {
      const text = makeText({ id: 't1' });
      const shape = makeShape({ id: 's1' });
      const image = makeImage({ id: 'i1' });
      const elements: CanvasElement[] = [text, shape, image];
      const before = snapshot(elements);

      const cmd: Command = {
        type: 'updateElements',
        ids: ['t1', 'i1'],
        updateFn: (el) => ({ x: el.x + 100 }),
      };
      const result = applyCommand(elements, cmd);

      expect((result[0] as TextElement).x).toBe(100);
      expect(result[1]).toBe(shape); // not targeted -> same reference
      expect((result[2] as ImageElement).x).toBe(105);
      expect(result[0]).not.toBe(text);
      expect(result[2]).not.toBe(image);

      expect(elements).toEqual(before);
    });

    it('handles an empty ids array (no-op, new array with same contents/refs)', () => {
      const text = makeText();
      const elements: CanvasElement[] = [text];
      const cmd: Command = { type: 'updateElements', ids: [], updateFn: () => ({ x: 1 }) };
      const result = applyCommand(elements, cmd);

      expect(result).not.toBe(elements);
      expect(result[0]).toBe(text);
    });
  });

  describe('deleteElements', () => {
    it('filters out the given ids', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const c = makeImage({ id: 'c' });
      const elements: CanvasElement[] = [a, b, c];
      const before = snapshot(elements);

      const result = applyCommand(elements, { type: 'deleteElements', ids: ['b'] });

      expect(result).toEqual([a, c]);
      expect(result[0]).toBe(a);
      expect(result[1]).toBe(c);
      expect(elements).toEqual(before);
    });

    it('handles an empty ids array (deletes nothing)', () => {
      const a = makeText({ id: 'a' });
      const elements: CanvasElement[] = [a];
      const result = applyCommand(elements, { type: 'deleteElements', ids: [] });
      expect(result).toEqual([a]);
      expect(result[0]).toBe(a);
    });

    it('is a no-op in content when the id does not exist', () => {
      const a = makeText({ id: 'a' });
      const elements: CanvasElement[] = [a];
      const result = applyCommand(elements, { type: 'deleteElements', ids: ['nonexistent'] });
      expect(result).toEqual([a]);
    });
  });

  describe('addElement', () => {
    it('appends the new element without touching existing ones', () => {
      const a = makeText({ id: 'a' });
      const elements: CanvasElement[] = [a];
      const newImage = makeImage({ id: 'new' });

      const result = applyCommand(elements, { type: 'addElement', element: newImage });

      expect(result).toEqual([a, newImage]);
      expect(result[0]).toBe(a);
      expect(result[1]).toBe(newImage);
      expect(elements.length).toBe(1); // original array untouched
    });
  });

  describe('bringToFront', () => {
    it('moves selected elements to the end, preserving the order given in ids (not original order)', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const c = makeImage({ id: 'c' });
      const elements: CanvasElement[] = [a, b, c];

      // ids given in reverse order relative to original array
      const result = applyCommand(elements, { type: 'bringToFront', ids: ['c', 'a'] });

      expect(result.map((el) => el.id)).toEqual(['b', 'c', 'a']);
      expect(result[0]).toBe(b);
      expect(result[1]).toBe(c);
      expect(result[2]).toBe(a);
    });

    it('handles an empty ids array (order unchanged)', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const elements: CanvasElement[] = [a, b];
      const result = applyCommand(elements, { type: 'bringToFront', ids: [] });
      expect(result.map((el) => el.id)).toEqual(['a', 'b']);
    });

    it('ignores ids that are not found', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const elements: CanvasElement[] = [a, b];
      const result = applyCommand(elements, { type: 'bringToFront', ids: ['missing', 'a'] });
      expect(result.map((el) => el.id)).toEqual(['b', 'a']);
    });
  });

  describe('sendToBack', () => {
    it('moves selected elements to the start, preserving the order given in ids', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const c = makeImage({ id: 'c' });
      const elements: CanvasElement[] = [a, b, c];

      const result = applyCommand(elements, { type: 'sendToBack', ids: ['c', 'a'] });

      expect(result.map((el) => el.id)).toEqual(['c', 'a', 'b']);
      expect(result[0]).toBe(c);
      expect(result[1]).toBe(a);
      expect(result[2]).toBe(b);
    });

    it('handles an empty ids array (order unchanged)', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const elements: CanvasElement[] = [a, b];
      const result = applyCommand(elements, { type: 'sendToBack', ids: [] });
      expect(result.map((el) => el.id)).toEqual(['a', 'b']);
    });
  });

  describe('reorderElements', () => {
    it('replaces the array wholesale with the given order', () => {
      const a = makeText({ id: 'a' });
      const b = makeShape({ id: 'b' });
      const elements: CanvasElement[] = [a, b];
      const newOrder = [b, a];

      const result = applyCommand(elements, { type: 'reorderElements', elements: newOrder });

      expect(result).toBe(newOrder);
      expect(result.map((el) => el.id)).toEqual(['b', 'a']);
    });
  });
});
