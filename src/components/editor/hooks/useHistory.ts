import { useCallback, useRef, useState } from 'react';
import type { CanvasElement } from '../types/template';

const MAX_HISTORY = 50;

// Pure history state: a linear undo/redo log plus an index into it. Kept
// framework-free so it can be unit tested without mounting a component.
//
// Structural sharing note: entries are stored as raw CanvasElement[]
// references, NOT deep clones. This is safe as long as every producer of a
// "newElements" array (documentCommands.applyCommand, and the handful of
// BannerEditor call sites that build arrays by hand) always creates brand-new
// array/object references instead of mutating in place. See useHistory.ts
// rewrite notes in the E1b task for the audit that confirmed this.
export interface HistoryState {
  entries: CanvasElement[][];
  index: number;
}

export function createHistoryState(initialElements: CanvasElement[] = []): HistoryState {
  return { entries: [initialElements], index: 0 };
}

export function historyPush(state: HistoryState, newElements: CanvasElement[]): HistoryState {
  const truncated = state.entries.slice(0, state.index + 1);
  truncated.push(newElements);
  const limited = truncated.slice(-MAX_HISTORY);
  return { entries: limited, index: limited.length - 1 };
}

// Replace the contents of the current top-of-history entry instead of
// pushing a new one. Used for coalescing continuous gestures (e.g. holding
// an arrow key) into a single undo step.
export function historyCoalesce(state: HistoryState, newElements: CanvasElement[]): HistoryState {
  const entries = state.entries.slice();
  entries[state.index] = newElements;
  return { entries, index: state.index };
}

// Pure decision: given the previous coalesceKey and the incoming one, decide
// whether to coalesce into the current top entry or push a new one. Kept
// separate from the React hook so the "does this key match the last one"
// rule is unit-testable without mounting anything.
export function historySave(
  state: HistoryState,
  lastCoalesceKey: string | undefined,
  newElements: CanvasElement[],
  coalesceKey?: string
): { state: HistoryState; lastCoalesceKey: string | undefined } {
  const canCoalesce = coalesceKey !== undefined && coalesceKey === lastCoalesceKey;
  const nextState = canCoalesce ? historyCoalesce(state, newElements) : historyPush(state, newElements);
  return { state: nextState, lastCoalesceKey: coalesceKey };
}

export function historyUndo(state: HistoryState): { state: HistoryState; elements: CanvasElement[] | null } {
  if (state.index > 0) {
    const index = state.index - 1;
    return { state: { entries: state.entries, index }, elements: state.entries[index] };
  }
  return { state, elements: null };
}

export function historyRedo(state: HistoryState): { state: HistoryState; elements: CanvasElement[] | null } {
  if (state.index < state.entries.length - 1) {
    const index = state.index + 1;
    return { state: { entries: state.entries, index }, elements: state.entries[index] };
  }
  return { state, elements: null };
}

export function historyCanUndo(state: HistoryState): boolean {
  return state.index > 0;
}

export function historyCanRedo(state: HistoryState): boolean {
  return state.index < state.entries.length - 1;
}

export const useHistory = () => {
  const [state, setState] = useState<HistoryState>(() => createHistoryState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Tracks the coalesceKey used by the most recent saveToHistory call so a
  // matching subsequent call can merge into the same entry instead of
  // pushing a new one. Reset on undo/redo/reset since those are not
  // "continuations" of an in-progress gesture.
  const lastCoalesceKeyRef = useRef<string | undefined>(undefined);

  const resetHistory = useCallback((initialElements: CanvasElement[] = []) => {
    const next = createHistoryState(initialElements);
    stateRef.current = next;
    lastCoalesceKeyRef.current = undefined;
    setState(next);
  }, []);

  const saveToHistory = useCallback((newElements: CanvasElement[], coalesceKey?: string) => {
    const { state: next, lastCoalesceKey } = historySave(
      stateRef.current,
      lastCoalesceKeyRef.current,
      newElements,
      coalesceKey
    );
    stateRef.current = next;
    lastCoalesceKeyRef.current = lastCoalesceKey;
    setState(next);
  }, []);

  const undo = useCallback((): CanvasElement[] | null => {
    const { state: next, elements } = historyUndo(stateRef.current);
    if (elements !== null) {
      stateRef.current = next;
      lastCoalesceKeyRef.current = undefined;
      setState(next);
    }
    return elements;
  }, []);

  const redo = useCallback((): CanvasElement[] | null => {
    const { state: next, elements } = historyRedo(stateRef.current);
    if (elements !== null) {
      stateRef.current = next;
      lastCoalesceKeyRef.current = undefined;
      setState(next);
    }
    return elements;
  }, []);

  const canUndo = historyCanUndo(state);
  const canRedo = historyCanRedo(state);

  return {
    resetHistory,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
