// Linear undo/redo log, framework-free so it can be unit tested without
// mounting a component.
//
// Structural sharing note: entries are stored by reference, never deep cloned.
// That is safe because every producer of an entry (the pure document reducer in
// documentStore.ts) builds brand-new arrays/objects instead of mutating in
// place.

export const MAX_HISTORY = 100;

export interface HistoryState<T> {
  entries: T[];
  index: number;
}

export function createHistory<T>(initial: T): HistoryState<T> {
  return { entries: [initial], index: 0 };
}

// Append an entry after the current one, discarding any redo tail.
export function historyPush<T>(state: HistoryState<T>, entry: T): HistoryState<T> {
  const truncated = state.entries.slice(0, state.index + 1);
  truncated.push(entry);
  const limited = truncated.slice(-MAX_HISTORY);
  return { entries: limited, index: limited.length - 1 };
}

// Replace the current entry instead of pushing a new one. Used to coalesce a
// continuous gesture (e.g. holding an arrow key) into a single undo step. Any
// redo tail is discarded: the entry it would redo into no longer exists.
export function historyReplaceCurrent<T>(state: HistoryState<T>, entry: T): HistoryState<T> {
  const entries = state.entries.slice(0, state.index + 1);
  entries[state.index] = entry;
  return { entries, index: state.index };
}

export function historyCurrent<T>(state: HistoryState<T>): T {
  return state.entries[state.index];
}

export function historyCanUndo<T>(state: HistoryState<T>): boolean {
  return state.index > 0;
}

export function historyCanRedo<T>(state: HistoryState<T>): boolean {
  return state.index < state.entries.length - 1;
}

export function historyUndo<T>(state: HistoryState<T>): HistoryState<T> {
  return historyCanUndo(state) ? { entries: state.entries, index: state.index - 1 } : state;
}

export function historyRedo<T>(state: HistoryState<T>): HistoryState<T> {
  return historyCanRedo(state) ? { entries: state.entries, index: state.index + 1 } : state;
}
