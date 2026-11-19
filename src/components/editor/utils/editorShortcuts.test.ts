import { describe, it, expect } from 'vitest';
import { classifyShortcutFocus, resolveShortcut, type ShortcutKeyEvent } from './editorShortcuts';

function key(k: string, mods: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return { key: k, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods };
}

const cmd = (k: string, mods: Partial<ShortcutKeyEvent> = {}) => key(k, { metaKey: true, ...mods });

describe('classifyShortcutFocus', () => {
  it('treats typing targets as text', () => {
    expect(classifyShortcutFocus({ tagName: 'TEXTAREA' })).toBe('text');
    expect(classifyShortcutFocus({ tagName: 'INPUT', type: 'text' })).toBe('text');
    expect(classifyShortcutFocus({ tagName: 'INPUT' })).toBe('text');
    expect(classifyShortcutFocus({ tagName: 'INPUT', type: 'number' })).toBe('text');
    expect(classifyShortcutFocus({ tagName: 'SELECT' })).toBe('text');
    expect(classifyShortcutFocus({ tagName: 'DIV', isContentEditable: true })).toBe('text');
  });

  it('treats sliders, checkboxes and buttons as controls', () => {
    expect(classifyShortcutFocus({ tagName: 'INPUT', type: 'range' })).toBe('control');
    expect(classifyShortcutFocus({ tagName: 'INPUT', type: 'checkbox' })).toBe('control');
    expect(classifyShortcutFocus({ tagName: 'INPUT', type: 'color' })).toBe('control');
    expect(classifyShortcutFocus({ tagName: 'BUTTON' })).toBe('control');
  });

  it('treats everything else as the canvas', () => {
    expect(classifyShortcutFocus({ tagName: 'BODY' })).toBe('canvas');
    expect(classifyShortcutFocus({ tagName: 'MAIN' })).toBe('canvas');
    expect(classifyShortcutFocus(null)).toBe('canvas');
  });
});

describe('resolveShortcut', () => {
  it('maps undo and both redo combinations', () => {
    expect(resolveShortcut(cmd('z'), 'canvas')).toEqual({ type: 'undo' });
    // Shift produces an uppercase key; it must still be recognised.
    expect(resolveShortcut(cmd('Z', { shiftKey: true }), 'canvas')).toEqual({ type: 'redo' });
    expect(resolveShortcut(cmd('y'), 'canvas')).toEqual({ type: 'redo' });
    expect(resolveShortcut(key('z', { ctrlKey: true }), 'canvas')).toEqual({ type: 'undo' });
  });

  it('maps clipboard, duplicate and select-all', () => {
    expect(resolveShortcut(cmd('c'), 'canvas')).toEqual({ type: 'copy' });
    expect(resolveShortcut(cmd('x'), 'canvas')).toEqual({ type: 'cut' });
    expect(resolveShortcut(cmd('d'), 'canvas')).toEqual({ type: 'duplicate' });
    expect(resolveShortcut(cmd('a'), 'canvas')).toEqual({ type: 'selectAll' });
  });

  it('leaves paste to the paste event so clipboard contents are available', () => {
    expect(resolveShortcut(cmd('v'), 'canvas')).toBeNull();
  });

  it('maps delete, backspace and escape', () => {
    expect(resolveShortcut(key('Delete'), 'canvas')).toEqual({ type: 'delete' });
    expect(resolveShortcut(key('Backspace'), 'canvas')).toEqual({ type: 'delete' });
    expect(resolveShortcut(key('Escape'), 'canvas')).toEqual({ type: 'escape' });
  });

  it('nudges by 1, or by 10 with Shift', () => {
    expect(resolveShortcut(key('ArrowLeft'), 'canvas')).toEqual({ type: 'nudge', dx: -1, dy: 0 });
    expect(resolveShortcut(key('ArrowDown'), 'canvas')).toEqual({ type: 'nudge', dx: 0, dy: 1 });
    expect(resolveShortcut(key('ArrowRight', { shiftKey: true }), 'canvas')).toEqual({ type: 'nudge', dx: 10, dy: 0 });
    expect(resolveShortcut(key('ArrowUp', { shiftKey: true }), 'canvas')).toEqual({ type: 'nudge', dx: 0, dy: -10 });
  });

  it('maps layer order shortcuts', () => {
    expect(resolveShortcut(cmd(']'), 'canvas')).toEqual({ type: 'bringForward' });
    expect(resolveShortcut(cmd('['), 'canvas')).toEqual({ type: 'sendBackward' });
    expect(resolveShortcut(cmd(']', { shiftKey: true }), 'canvas')).toEqual({ type: 'bringToFront' });
    expect(resolveShortcut(cmd('}', { shiftKey: true }), 'canvas')).toEqual({ type: 'bringToFront' });
    expect(resolveShortcut(cmd('{', { shiftKey: true }), 'canvas')).toEqual({ type: 'sendToBack' });
  });

  it('maps zoom shortcuts', () => {
    expect(resolveShortcut(cmd('='), 'canvas')).toEqual({ type: 'zoomIn' });
    expect(resolveShortcut(cmd('+', { shiftKey: true }), 'canvas')).toEqual({ type: 'zoomIn' });
    expect(resolveShortcut(cmd('-'), 'canvas')).toEqual({ type: 'zoomOut' });
    expect(resolveShortcut(cmd('0'), 'canvas')).toEqual({ type: 'zoomFit' });
    expect(resolveShortcut(key('!', { shiftKey: true, code: 'Digit1' }), 'canvas')).toEqual({ type: 'zoomFit' });
    expect(resolveShortcut(key(')', { shiftKey: true, code: 'Digit0' }), 'canvas')).toEqual({ type: 'zoomActual' });
  });

  it('gives a text field every key except save', () => {
    expect(resolveShortcut(cmd('z'), 'text')).toBeNull();
    expect(resolveShortcut(cmd('a'), 'text')).toBeNull();
    expect(resolveShortcut(key('Backspace'), 'text')).toBeNull();
    expect(resolveShortcut(key('ArrowLeft'), 'text')).toBeNull();
    expect(resolveShortcut(key('Escape'), 'text')).toBeNull();
    expect(resolveShortcut(cmd('s'), 'text')).toEqual({ type: 'save' });
  });

  it('keeps editor shortcuts alive while a slider or button has focus', () => {
    expect(resolveShortcut(cmd('z'), 'control')).toEqual({ type: 'undo' });
    expect(resolveShortcut(key('Delete'), 'control')).toEqual({ type: 'delete' });
    expect(resolveShortcut(cmd('d'), 'control')).toEqual({ type: 'duplicate' });
  });

  it('leaves the arrow keys to a focused control', () => {
    expect(resolveShortcut(key('ArrowLeft'), 'control')).toBeNull();
    expect(resolveShortcut(key('ArrowUp', { shiftKey: true }), 'control')).toBeNull();
  });

  it('ignores keys pressed during IME composition', () => {
    expect(resolveShortcut(key('Backspace', { isComposing: true }), 'canvas')).toBeNull();
    expect(resolveShortcut(cmd('z', { isComposing: true }), 'canvas')).toBeNull();
  });

  it('ignores combinations it does not define', () => {
    expect(resolveShortcut(key('z'), 'canvas')).toBeNull();
    expect(resolveShortcut(cmd('k'), 'canvas')).toBeNull();
    expect(resolveShortcut(cmd('z', { altKey: true }), 'canvas')).toBeNull();
    expect(resolveShortcut(key('ArrowLeft', { altKey: true }), 'canvas')).toBeNull();
  });
});
