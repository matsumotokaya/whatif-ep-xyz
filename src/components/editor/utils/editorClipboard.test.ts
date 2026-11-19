import { describe, it, expect } from 'vitest';
import {
  clipboardMarkerHtml,
  clipboardPlainText,
  readClipboardToken,
  resolvePasteSource,
} from './editorClipboard';
import type { CanvasElement } from '../types/template';

const TOKEN = '3f2c1a9e-0b7d-4c55-9f10-6a1b2c3d4e5f';
const image = { name: 'shot.png' } as File;

const textElement = (text: string): CanvasElement => ({
  id: `text-${text}`,
  type: 'text',
  x: 0,
  y: 0,
  text,
  fontSize: 40,
  fontFamily: 'Arial',
  letterSpacing: 0,
  fill: '#000000',
  fillEnabled: true,
  stroke: '#000000',
  strokeWidth: 2,
  strokeEnabled: false,
  fontWeight: 400,
});

describe('clipboard marker', () => {
  it('round-trips the token through the HTML marker', () => {
    expect(readClipboardToken(clipboardMarkerHtml(TOKEN, 'hello'))).toBe(TOKEN);
  });

  it('survives the wrapper a browser adds around pasted HTML', () => {
    const pasted = `<meta charset='utf-8'><span data-whatif-clipboard="${TOKEN}">hello</span>`;
    expect(readClipboardToken(pasted)).toBe(TOKEN);
  });

  it('returns null for HTML without a marker', () => {
    expect(readClipboardToken('<b>plain</b>')).toBeNull();
    expect(readClipboardToken('')).toBeNull();
    expect(readClipboardToken(null)).toBeNull();
  });

  it('escapes copied text so it cannot break out of the marker element', () => {
    const html = clipboardMarkerHtml(TOKEN, '<img src=x onerror="alert(1)"> & more');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&amp; more');
    expect(readClipboardToken(html)).toBe(TOKEN);
  });

  it('exposes the text of copied text elements, one per line', () => {
    const shape = { id: 's', type: 'shape' } as unknown as CanvasElement;
    expect(clipboardPlainText([textElement('first'), shape, textElement('second')])).toBe('first\nsecond');
    expect(clipboardPlainText([shape])).toBe('');
  });
});

describe('resolvePasteSource', () => {
  const marked = { token: TOKEN, markedOnSystem: true };
  const unmarked = { token: TOKEN, markedOnSystem: false };
  const ours = clipboardMarkerHtml(TOKEN, '');

  it('pastes elements when the system clipboard still holds our marker', () => {
    expect(resolvePasteSource({ html: ours, text: 'hello', imageFiles: [], internal: marked })).toEqual({ kind: 'elements' });
  });

  it('pastes an image copied after the elements', () => {
    expect(resolvePasteSource({ html: '', text: '', imageFiles: [image], internal: marked })).toEqual({
      kind: 'images',
      files: [image],
    });
  });

  it('pastes text copied after the elements', () => {
    expect(resolvePasteSource({ html: '<b>new</b>', text: 'new', imageFiles: [], internal: marked })).toEqual({
      kind: 'text',
      text: 'new',
    });
  });

  it('does not mistake a marker from an older copy for the current one', () => {
    const stale = clipboardMarkerHtml('00000000-0000-4000-8000-000000000000', '');
    expect(resolvePasteSource({ html: stale, text: 'x', imageFiles: [], internal: marked })).toEqual({
      kind: 'text',
      text: 'x',
    });
  });

  it('trusts the element copy when the system clipboard could not be tagged', () => {
    expect(resolvePasteSource({ html: '', text: 'stale text', imageFiles: [image], internal: unmarked })).toEqual({
      kind: 'elements',
    });
  });

  it('falls back to the element copy when the system clipboard is empty', () => {
    expect(resolvePasteSource({ html: '', text: '  ', imageFiles: [], internal: marked })).toEqual({ kind: 'elements' });
  });

  it('pastes images or text when nothing was copied in the editor', () => {
    expect(resolvePasteSource({ html: '', text: '', imageFiles: [image], internal: null }).kind).toBe('images');
    expect(resolvePasteSource({ html: '', text: 'note', imageFiles: [], internal: null })).toEqual({ kind: 'text', text: 'note' });
  });

  it('does nothing when there is nothing to paste', () => {
    expect(resolvePasteSource({ html: '', text: '', imageFiles: [], internal: null })).toEqual({ kind: 'none' });
  });
});
