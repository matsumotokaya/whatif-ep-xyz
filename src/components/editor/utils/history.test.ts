import { describe, it, expect } from 'vitest';
import {
  MAX_HISTORY,
  createHistory,
  historyCanRedo,
  historyCanUndo,
  historyCurrent,
  historyPush,
  historyRedo,
  historyReplaceCurrent,
  historyUndo,
} from './history';

describe('history', () => {
  it('starts with a single entry and nothing to undo or redo', () => {
    const state = createHistory('a');
    expect(state.entries).toEqual(['a']);
    expect(historyCurrent(state)).toBe('a');
    expect(historyCanUndo(state)).toBe(false);
    expect(historyCanRedo(state)).toBe(false);
  });

  it('push appends an entry and makes it current', () => {
    const state = historyPush(createHistory('a'), 'b');
    expect(state.entries).toEqual(['a', 'b']);
    expect(historyCurrent(state)).toBe('b');
    expect(historyCanUndo(state)).toBe(true);
    expect(historyCanRedo(state)).toBe(false);
  });

  it('undo and redo move along the log without changing it', () => {
    const pushed = historyPush(historyPush(createHistory('a'), 'b'), 'c');
    const undone = historyUndo(pushed);
    expect(historyCurrent(undone)).toBe('b');
    expect(undone.entries).toBe(pushed.entries);
    expect(historyCanRedo(undone)).toBe(true);
    expect(historyCurrent(historyRedo(undone))).toBe('c');
  });

  it('undo at the oldest entry and redo at the newest return the same state', () => {
    const state = historyPush(createHistory('a'), 'b');
    const oldest = historyUndo(state);
    expect(historyUndo(oldest)).toBe(oldest);
    expect(historyRedo(state)).toBe(state);
  });

  it('pushing after an undo discards the redo tail', () => {
    const undone = historyUndo(historyPush(historyPush(createHistory('a'), 'b'), 'c'));
    const branched = historyPush(undone, 'd');
    expect(branched.entries).toEqual(['a', 'b', 'd']);
    expect(historyCanRedo(branched)).toBe(false);
  });

  it('replaceCurrent swaps the current entry without growing the log', () => {
    const state = historyReplaceCurrent(historyPush(createHistory('a'), 'b'), 'b2');
    expect(state.entries).toEqual(['a', 'b2']);
    expect(state.index).toBe(1);
  });

  it('replaceCurrent discards a redo tail that no longer follows the entry', () => {
    const undone = historyUndo(historyPush(historyPush(createHistory('a'), 'b'), 'c'));
    const replaced = historyReplaceCurrent(undone, 'b2');
    expect(replaced.entries).toEqual(['a', 'b2']);
    expect(historyCanRedo(replaced)).toBe(false);
  });

  it('keeps at most MAX_HISTORY entries, dropping the oldest', () => {
    let state = createHistory(0);
    for (let i = 1; i <= MAX_HISTORY + 10; i++) {
      state = historyPush(state, i);
    }
    expect(state.entries).toHaveLength(MAX_HISTORY);
    expect(state.entries[0]).toBe(11);
    expect(historyCurrent(state)).toBe(MAX_HISTORY + 10);
    expect(state.index).toBe(MAX_HISTORY - 1);
  });

  it('does not mutate the previous state', () => {
    const first = createHistory('a');
    historyPush(first, 'b');
    historyReplaceCurrent(first, 'z');
    expect(first.entries).toEqual(['a']);
    expect(first.index).toBe(0);
  });
});
