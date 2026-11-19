import { describe, it, expect, vi } from 'vitest';
import {
  DocumentStore,
  canRedoDocument,
  canUndoDocument,
  createDocumentState,
  reduceDocument,
  type DocumentAction,
  type DocumentState,
} from './documentStore';
import type { CanvasElement, ShapeElement } from '../types/template';

function shape(id: string, overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
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
    ...overrides,
  };
}

function start(elements: CanvasElement[] = [shape('a'), shape('b')], canvasColor = '#ffffff'): DocumentState {
  return createDocumentState({ elements, canvasColor });
}

function run(state: DocumentState, ...actions: DocumentAction[]): DocumentState {
  return actions.reduce(reduceDocument, state);
}

const moveA = (x: number, extra: Partial<DocumentAction & { type: 'commands' }> = {}): DocumentAction => ({
  type: 'commands',
  commands: [{ type: 'updateElement', id: 'a', updates: { x } }],
  ...extra,
});

const xOf = (state: DocumentState, id: string) => state.elements.find((el) => el.id === id)?.x;

describe('reduceDocument', () => {
  it('records each committed edit as one undo step', () => {
    const edited = run(start(), moveA(10), moveA(20));
    expect(xOf(edited, 'a')).toBe(20);
    expect(edited.history.entries).toHaveLength(3);

    const undone = reduceDocument(edited, { type: 'undo' });
    expect(xOf(undone, 'a')).toBe(10);
    expect(xOf(run(undone, { type: 'undo' }), 'a')).toBe(0);
    expect(xOf(run(undone, { type: 'redo' }), 'a')).toBe(20);
  });

  it('applies several commands in one action as a single undo step', () => {
    const state = run(start(), {
      type: 'commands',
      commands: [
        { type: 'addElement', element: shape('c') },
        { type: 'addElement', element: shape('d') },
      ],
    });
    expect(state.elements.map((el) => el.id)).toEqual(['a', 'b', 'c', 'd']);

    const undone = reduceDocument(state, { type: 'undo' });
    expect(undone.elements.map((el) => el.id)).toEqual(['a', 'b']);
  });

  it('is pure: reducing the same state twice yields equal results and no shared growth', () => {
    const base = start();
    const first = reduceDocument(base, moveA(10));
    const second = reduceDocument(base, moveA(10));
    expect(second).toEqual(first);
    expect(base.history.entries).toHaveLength(1);
    expect(first.history.entries).toHaveLength(2);
  });

  it('ignores an edit that leaves every value unchanged', () => {
    const base = start();
    expect(reduceDocument(base, moveA(0))).toBe(base);
    expect(reduceDocument(base, { type: 'canvasColor', color: '#ffffff' })).toBe(base);
    expect(reduceDocument(base, { type: 'commands', commands: [{ type: 'bringToFront', ids: ['b'] }] })).toBe(base);
  });

  it('keeps the identity of elements an edit did not touch', () => {
    const base = start();
    const edited = reduceDocument(base, moveA(10));
    expect(edited.elements[1]).toBe(base.elements[1]);
    expect(edited.elements[0]).not.toBe(base.elements[0]);
  });

  it('merges consecutive edits that share a coalesce key into one undo step', () => {
    const state = run(start(), moveA(1, { coalesceKey: 'nudge:a' }), moveA(2, { coalesceKey: 'nudge:a' }), moveA(3, { coalesceKey: 'nudge:a' }));
    expect(state.history.entries).toHaveLength(2);
    expect(xOf(reduceDocument(state, { type: 'undo' }), 'a')).toBe(0);
  });

  it('starts a new undo step when the coalesce key changes or is absent', () => {
    const state = run(start(), moveA(1, { coalesceKey: 'nudge:a' }), moveA(2, { coalesceKey: 'nudge:b' }), moveA(3), moveA(4, { coalesceKey: 'nudge:a' }));
    expect(state.history.entries).toHaveLength(5);
  });

  it('does not coalesce across an undo', () => {
    const nudged = run(start(), moveA(1, { coalesceKey: 'nudge:a' }), moveA(2, { coalesceKey: 'nudge:a' }));
    const state = run(nudged, { type: 'undo' }, moveA(5, { coalesceKey: 'nudge:a' }));
    expect(state.history.entries).toHaveLength(2);
    expect(xOf(reduceDocument(state, { type: 'undo' }), 'a')).toBe(0);
  });

  it('previews transient edits without adding undo steps', () => {
    const state = run(start(), moveA(5, { transient: true }), moveA(9, { transient: true }));
    expect(xOf(state, 'a')).toBe(9);
    expect(state.hasTransient).toBe(true);
    expect(state.history.entries).toHaveLength(1);
  });

  it('records a transient gesture as exactly one undo step on commit', () => {
    const state = run(start(), moveA(5, { transient: true }), moveA(9, { transient: true }), { type: 'commitTransient' });
    expect(state.hasTransient).toBe(false);
    expect(state.history.entries).toHaveLength(2);
    expect(xOf(reduceDocument(state, { type: 'undo' }), 'a')).toBe(0);
  });

  it('does not record a transient gesture that ended where it started', () => {
    const base = start();
    const state = run(base, moveA(5, { transient: true }), moveA(0, { transient: true }), { type: 'commitTransient' });
    expect(state.history.entries).toHaveLength(1);
    expect(state.hasTransient).toBe(false);
    expect(state.elements).toBe(base.elements);
  });

  it('commitTransient without a pending preview returns the same state', () => {
    const base = start();
    expect(reduceDocument(base, { type: 'commitTransient' })).toBe(base);
  });

  it('undo with an uncommitted preview steps back from it and redo returns to it', () => {
    const previewed = run(start(), moveA(10), moveA(25, { transient: true }));
    expect(canUndoDocument(previewed)).toBe(true);

    const undone = reduceDocument(previewed, { type: 'undo' });
    expect(xOf(undone, 'a')).toBe(10);
    expect(xOf(reduceDocument(undone, { type: 'redo' }), 'a')).toBe(25);
  });

  it('can undo a preview made on a fresh document', () => {
    const previewed = run(start(), moveA(7, { transient: true }));
    expect(canUndoDocument(previewed)).toBe(true);
    expect(xOf(reduceDocument(previewed, { type: 'undo' }), 'a')).toBe(0);
  });

  it('folds a pending preview into the next committed edit as a new step', () => {
    const state = run(
      start(),
      moveA(1, { coalesceKey: 'nudge:a' }),
      moveA(5, { transient: true }),
      moveA(6, { coalesceKey: 'nudge:a' }),
    );
    expect(state.hasTransient).toBe(false);
    expect(state.history.entries).toHaveLength(3);
    expect(xOf(reduceDocument(state, { type: 'undo' }), 'a')).toBe(1);
  });

  it('treats the canvas color as part of the undoable document', () => {
    const state = run(start(), moveA(10), { type: 'canvasColor', color: '#000000' });
    expect(state.canvasColor).toBe('#000000');

    const undone = reduceDocument(state, { type: 'undo' });
    expect(undone.canvasColor).toBe('#ffffff');
    expect(xOf(undone, 'a')).toBe(10);
  });

  it('previews canvas color changes and records them once', () => {
    const state = run(
      start(),
      { type: 'canvasColor', color: '#111111', transient: true },
      { type: 'canvasColor', color: '#222222', transient: true },
      { type: 'commitTransient' },
    );
    expect(state.canvasColor).toBe('#222222');
    expect(state.history.entries).toHaveLength(2);
  });

  it('bumps the revision on every content change and only then', () => {
    const base = start();
    const edited = reduceDocument(base, moveA(10));
    expect(edited.revision).toBe(base.revision + 1);
    expect(reduceDocument(edited, moveA(10)).revision).toBe(edited.revision);
    expect(reduceDocument(edited, { type: 'undo' }).revision).toBe(edited.revision + 1);
    expect(reduceDocument(base, { type: 'undo' }).revision).toBe(base.revision);
  });

  it('reports redo as unavailable while a preview is pending', () => {
    const undone = run(start(), moveA(10), { type: 'undo' });
    expect(canRedoDocument(undone)).toBe(true);
    const previewed = reduceDocument(undone, moveA(3, { transient: true }));
    expect(canRedoDocument(previewed)).toBe(false);
    // The preview becomes the newest state, so the old redo target is gone.
    expect(xOf(reduceDocument(previewed, { type: 'redo' }), 'a')).toBe(3);
  });
});

describe('DocumentStore', () => {
  it('notifies subscribers only when the document changes', () => {
    const store = new DocumentStore({ elements: [shape('a')], canvasColor: '#ffffff' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch(moveA(10));
    store.dispatch(moveA(10));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().elements[0].x).toBe(10);

    unsubscribe();
    store.dispatch(moveA(20));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('exposes the latest state synchronously after a dispatch', () => {
    const store = new DocumentStore({ elements: [shape('a')], canvasColor: '#ffffff' });
    store.dispatch({ type: 'commands', commands: [{ type: 'addElement', element: shape('b') }] });
    store.dispatch({ type: 'commands', commands: [{ type: 'addElement', element: shape('c') }] });
    expect(store.getState().elements.map((el) => el.id)).toEqual(['a', 'b', 'c']);
  });
});
