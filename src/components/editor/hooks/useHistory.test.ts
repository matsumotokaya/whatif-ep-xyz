import { describe, it, expect } from 'vitest';
import {
  createHistoryState,
  historyPush,
  historyCoalesce,
  historySave,
  historyUndo,
  historyRedo,
  historyCanUndo,
  historyCanRedo,
  type HistoryState,
} from './useHistory';
import type { CanvasElement, TextElement } from '../types/template';

function makeText(id: string, x = 0): TextElement {
  return {
    id,
    type: 'text',
    x,
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
  };
}

describe('useHistory pure functions', () => {
  it('createHistoryState seeds a single entry at index 0', () => {
    const initial: CanvasElement[] = [makeText('a')];
    const state = createHistoryState(initial);
    expect(state.entries).toEqual([initial]);
    expect(state.index).toBe(0);
    expect(historyCanUndo(state)).toBe(false);
    expect(historyCanRedo(state)).toBe(false);
  });

  it('historyPush (basic): appends a new entry and advances the index', () => {
    const state = createHistoryState([]);
    const gen1 = [makeText('a')];
    const next = historyPush(state, gen1);
    expect(next.entries).toEqual([[], gen1]);
    expect(next.index).toBe(1);
    expect(historyCanUndo(next)).toBe(true);
    expect(historyCanRedo(next)).toBe(false);
  });

  it('historyUndo moves the index back and returns the previous entry', () => {
    let state = createHistoryState([]);
    const gen1 = [makeText('a')];
    state = historyPush(state, gen1);

    const { state: afterUndo, elements } = historyUndo(state);
    expect(elements).toEqual([]);
    expect(afterUndo.index).toBe(0);
  });

  it('historyUndo returns null when already at the oldest entry', () => {
    const state = createHistoryState([]);
    const { state: afterUndo, elements } = historyUndo(state);
    expect(elements).toBeNull();
    expect(afterUndo).toBe(state); // unchanged
  });

  it('historyRedo moves the index forward and returns the next entry', () => {
    let state = createHistoryState([]);
    const gen1 = [makeText('a')];
    state = historyPush(state, gen1);
    const { state: afterUndo } = historyUndo(state);

    const { state: afterRedo, elements } = historyRedo(afterUndo);
    expect(elements).toEqual(gen1);
    expect(afterRedo.index).toBe(1);
  });

  it('historyRedo returns null when already at the newest entry', () => {
    const state = createHistoryState([]);
    const { state: afterRedo, elements } = historyRedo(state);
    expect(elements).toBeNull();
    expect(afterRedo).toBe(state);
  });

  it('undo-then-push clears future (redo unavailable after a new edit)', () => {
    let state = createHistoryState([]);
    state = historyPush(state, [makeText('a')]);
    state = historyPush(state, [makeText('a'), makeText('b')]);
    // undo back to the first push
    const { state: afterUndo } = historyUndo(state);
    expect(historyCanRedo(afterUndo)).toBe(true);

    // now push a brand new edit from this point
    const afterNewEdit = historyPush(afterUndo, [makeText('a'), makeText('c')]);
    expect(historyCanRedo(afterNewEdit)).toBe(false);
    expect(afterNewEdit.entries).toEqual([[], [makeText('a')], [makeText('a'), makeText('c')]]);
  });

  it('historyCoalesce replaces the current top entry contents without growing the log', () => {
    let state = createHistoryState([]);
    state = historyPush(state, [makeText('a', 1)]);
    const beforeLength = state.entries.length;

    const coalesced = historyCoalesce(state, [makeText('a', 2)]);
    expect(coalesced.entries.length).toBe(beforeLength); // no growth
    expect(coalesced.index).toBe(state.index);
    expect(coalesced.entries[coalesced.index]).toEqual([makeText('a', 2)]);
  });

  it('historySave: matching coalesceKey merges into the same entry (does not grow undo count)', () => {
    let state = createHistoryState([makeText('a', 0)]);
    let lastKey: string | undefined = undefined;

    // First nudge starts a new coalesce group (no previous key to match).
    let result = historySave(state, lastKey, [makeText('a', 1)], 'nudge');
    state = result.state;
    lastKey = result.lastCoalesceKey;
    expect(state.entries.length).toBe(2); // pushed once

    // Second nudge with the same key coalesces into the existing entry.
    result = historySave(state, lastKey, [makeText('a', 2)], 'nudge');
    state = result.state;
    lastKey = result.lastCoalesceKey;
    expect(state.entries.length).toBe(2); // did not grow
    expect(state.entries[state.index]).toEqual([makeText('a', 2)]);

    // Third nudge, same key again.
    result = historySave(state, lastKey, [makeText('a', 3)], 'nudge');
    state = result.state;
    expect(state.entries.length).toBe(2);
    expect(state.entries[state.index]).toEqual([makeText('a', 3)]);
  });

  it('historySave: a different or absent key does not merge across the boundary', () => {
    let state = createHistoryState([makeText('a', 0)]);

    // Start a nudge group.
    let result = historySave(state, undefined, [makeText('a', 1)], 'nudge');
    state = result.state;
    let lastKey = result.lastCoalesceKey;
    expect(state.entries.length).toBe(2);

    // An unrelated edit with no coalesceKey always pushes a new entry.
    result = historySave(state, lastKey, [makeText('a', 1), makeText('b')], undefined);
    state = result.state;
    lastKey = result.lastCoalesceKey;
    expect(state.entries.length).toBe(3);

    // A subsequent nudge with the same 'nudge' key does NOT merge into the
    // unrelated edit, because the last key is now undefined.
    result = historySave(state, lastKey, [makeText('a', 2), makeText('b')], 'nudge');
    state = result.state;
    expect(state.entries.length).toBe(4);
  });

  it('historySave: a different coalesceKey than the previous one pushes a new entry', () => {
    let state = createHistoryState([makeText('a', 0)]);
    let result = historySave(state, undefined, [makeText('a', 1)], 'nudge-x');
    state = result.state;
    const lastKey = result.lastCoalesceKey;
    expect(state.entries.length).toBe(2);

    result = historySave(state, lastKey, [makeText('a', 1), makeText('b')], 'nudge-y');
    state = result.state;
    expect(state.entries.length).toBe(3);
  });

  it('caps at MAX_HISTORY=50: oldest entries are dropped, undo availability stays correct', () => {
    let state = createHistoryState([]);
    // Push 60 generations (60 pushes on top of the initial entry = 61 total before capping).
    for (let i = 1; i <= 60; i++) {
      state = historyPush(state, [makeText('a', i)]);
    }
    expect(state.entries.length).toBe(50);
    expect(state.index).toBe(49);
    expect(historyCanUndo(state)).toBe(true);
    expect(historyCanRedo(state)).toBe(false);
    // The newest entry should be the last push (x = 60).
    expect(state.entries[state.index]).toEqual([makeText('a', 60)]);

    // Undo all the way to the oldest retained entry.
    let cursor: HistoryState = state;
    for (let i = 0; i < 49; i++) {
      const { state: next } = historyUndo(cursor);
      cursor = next;
    }
    expect(historyCanUndo(cursor)).toBe(false);
    // Oldest retained entry corresponds to x = 60 - 49 = 11 (since only the
    // most recent 50 of the 61 total entries survive: initial + pushes 1..60
    // = 61 entries, capped to the last 50, i.e. pushes 11..60 plus none of
    // the earlier ones or the initial []).
    expect(cursor.entries[cursor.index]).toEqual([makeText('a', 11)]);
  });

  it('reset (createHistoryState) replaces history with a single fresh entry', () => {
    let state = createHistoryState([]);
    state = historyPush(state, [makeText('a')]);
    state = historyPush(state, [makeText('a'), makeText('b')]);

    const resetState = createHistoryState([makeText('fresh')]);
    expect(resetState.entries).toEqual([[makeText('fresh')]]);
    expect(resetState.index).toBe(0);
    expect(historyCanUndo(resetState)).toBe(false);
    expect(historyCanRedo(resetState)).toBe(false);
  });
});
