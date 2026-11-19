import { describe, it, expect } from 'vitest';
import { collectFontRequests, fontRequestsKey, konvaFontStyle, textFontSpec } from './textFont';
import type { CanvasElement, TextElement } from '../types/template';

const text = (overrides: Partial<TextElement>): TextElement => ({
  id: 't',
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
});

describe('konvaFontStyle', () => {
  it('maps numeric weights onto the three styles the canvas draws', () => {
    expect([100, 200, 300].map(konvaFontStyle)).toEqual(['lighter', 'lighter', 'lighter']);
    expect([400, 500, 600].map(konvaFontStyle)).toEqual(['normal', 'normal', 'normal']);
    expect([700, 800, 900].map(konvaFontStyle)).toEqual(['bold', 'bold', 'bold']);
  });
});

describe('textFontSpec', () => {
  it('builds the font shorthand the canvas requests', () => {
    expect(textFontSpec(text({ fontWeight: 900, fontSize: 120, fontFamily: '"Noto Sans JP", sans-serif' })))
      .toBe('bold 120px "Noto Sans JP", sans-serif');
  });
});

describe('collectFontRequests', () => {
  it('groups the text of every element drawn with the same face', () => {
    const elements: CanvasElement[] = [
      text({ id: 'a', text: 'あい' }),
      text({ id: 'b', text: 'うえ' }),
      text({ id: 'c', text: 'bold', fontWeight: 700 }),
      { id: 'shape', type: 'shape' } as unknown as CanvasElement,
    ];
    expect(collectFontRequests(elements)).toEqual([
      { spec: 'normal 40px Arial', text: 'あいうえ' },
      { spec: 'bold 40px Arial', text: 'bold' },
    ]);
  });

  it('returns nothing for a design without text', () => {
    expect(collectFontRequests([])).toEqual([]);
  });
});

describe('fontRequestsKey', () => {
  it('is the same for the same faces and glyphs regardless of order or repetition', () => {
    const first = fontRequestsKey([{ spec: 'a', text: 'hello' }, { spec: 'b', text: 'xy' }]);
    const second = fontRequestsKey([{ spec: 'b', text: 'yxx' }, { spec: 'a', text: 'olleh' }]);
    expect(second).toBe(first);
  });

  it('changes when a new glyph or face is needed', () => {
    const base = fontRequestsKey([{ spec: 'a', text: 'hello' }]);
    expect(fontRequestsKey([{ spec: 'a', text: 'hello!' }])).not.toBe(base);
    expect(fontRequestsKey([{ spec: 'b', text: 'hello' }])).not.toBe(base);
  });
});
