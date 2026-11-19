import type { CanvasElement } from '../types/template';
import { applyCommand, reconcileElements, type Command } from './documentCommands';
import {
  createHistory,
  historyCanRedo,
  historyCanUndo,
  historyCurrent,
  historyPush,
  historyRedo,
  historyReplaceCurrent,
  historyUndo,
  type HistoryState,
} from './history';

// The editable document: everything undo/redo restores and autosave persists.
export interface DocumentSnapshot {
  elements: CanvasElement[];
  canvasColor: string;
}

export interface DocumentState extends DocumentSnapshot {
  history: HistoryState<DocumentSnapshot>;
  // Key of the gesture that produced the current history entry. A following
  // edit with the same key replaces that entry instead of adding one.
  coalesceKey: string | undefined;
  // True while live-preview edits (slider drag, pinch) have changed the
  // document without a history entry yet.
  hasTransient: boolean;
  // Bumped on every change to the document content. Persistence compares it
  // against the revision it last wrote.
  revision: number;
}

export type DocumentAction =
  // `transient` applies the change as a live preview without an undo entry;
  // the gesture is recorded as ONE entry by a later `commitTransient`.
  | { type: 'commands'; commands: Command[]; coalesceKey?: string; transient?: boolean }
  | { type: 'canvasColor'; color: string; transient?: boolean }
  | { type: 'commitTransient' }
  | { type: 'undo' }
  | { type: 'redo' };

export function createDocumentState(snapshot: DocumentSnapshot): DocumentState {
  const initial = { elements: snapshot.elements, canvasColor: snapshot.canvasColor };
  return {
    ...initial,
    history: createHistory(initial),
    coalesceKey: undefined,
    hasTransient: false,
    revision: 0,
  };
}

export function canUndoDocument(state: DocumentState): boolean {
  return state.hasTransient || historyCanUndo(state.history);
}

export function canRedoDocument(state: DocumentState): boolean {
  return !state.hasTransient && historyCanRedo(state.history);
}

// Record the live document as a history entry. A preview that ended where it
// started (slider dragged out and back) leaves the log untouched.
function commitTransient(state: DocumentState): DocumentState {
  if (!state.hasTransient) return state;

  const recorded = historyCurrent(state.history);
  const elements = reconcileElements(recorded.elements, state.elements);
  if (elements === recorded.elements && state.canvasColor === recorded.canvasColor) {
    return { ...state, elements, hasTransient: false, coalesceKey: undefined };
  }

  return {
    ...state,
    elements,
    history: historyPush(state.history, { elements, canvasColor: state.canvasColor }),
    hasTransient: false,
    coalesceKey: undefined,
  };
}

function applyChange(
  state: DocumentState,
  next: DocumentSnapshot,
  options: { transient?: boolean; coalesceKey?: string },
): DocumentState {
  const elements = reconcileElements(state.elements, next.elements);
  if (elements === state.elements && next.canvasColor === state.canvasColor) return state;

  const content = { elements, canvasColor: next.canvasColor };
  if (options.transient) {
    return { ...state, ...content, hasTransient: true, revision: state.revision + 1 };
  }

  // A pending preview is folded into this entry, so it must be a new one.
  const coalesce =
    !state.hasTransient
    && options.coalesceKey !== undefined
    && options.coalesceKey === state.coalesceKey;

  return {
    ...state,
    ...content,
    history: coalesce
      ? historyReplaceCurrent(state.history, content)
      : historyPush(state.history, content),
    coalesceKey: options.coalesceKey,
    hasTransient: false,
    revision: state.revision + 1,
  };
}

function restore(state: DocumentState, history: HistoryState<DocumentSnapshot>): DocumentState {
  if (history === state.history) return state;
  const entry = historyCurrent(history);
  return {
    ...state,
    elements: entry.elements,
    canvasColor: entry.canvasColor,
    history,
    coalesceKey: undefined,
    hasTransient: false,
    revision: state.revision + 1,
  };
}

// Pure reducer: safe to invoke repeatedly with the same arguments.
export function reduceDocument(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case 'commands': {
      const elements = action.commands.reduce(applyCommand, state.elements);
      return applyChange(state, { elements, canvasColor: state.canvasColor }, action);
    }
    case 'canvasColor':
      return applyChange(state, { elements: state.elements, canvasColor: action.color }, action);
    case 'commitTransient':
      return commitTransient(state);
    case 'undo': {
      // An uncommitted preview is the newest state: record it first so the
      // undo steps back from it and redo can still return to it.
      const committed = commitTransient(state);
      return restore(committed, historyUndo(committed.history));
    }
    case 'redo': {
      const committed = commitTransient(state);
      return restore(committed, historyRedo(committed.history));
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// Minimal external store around the reducer. Reads are synchronous, so event
// handlers and the save queue can always see the latest document without
// capturing it in a closure.
export class DocumentStore {
  private state: DocumentState;
  private readonly listeners = new Set<() => void>();

  constructor(snapshot: DocumentSnapshot) {
    this.state = createDocumentState(snapshot);
  }

  getState = (): DocumentState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispatch = (action: DocumentAction): void => {
    const next = reduceDocument(this.state, action);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  };

  // Apply one or more commands as a single undo step.
  apply(commands: Command | Command[], coalesceKey?: string): void {
    this.dispatch({ type: 'commands', commands: Array.isArray(commands) ? commands : [commands], coalesceKey });
  }

  // Apply commands as a live preview (slider drag, pinch). Nothing is recorded
  // until commitPreview().
  preview(commands: Command | Command[]): void {
    this.dispatch({ type: 'commands', commands: Array.isArray(commands) ? commands : [commands], transient: true });
  }

  // Record everything previewed since the last undo step as one step.
  commitPreview(): void {
    this.dispatch({ type: 'commitTransient' });
  }

  setCanvasColor(color: string, options: { transient?: boolean } = {}): void {
    this.dispatch({ type: 'canvasColor', color, transient: options.transient });
  }

  undo(): void {
    this.dispatch({ type: 'undo' });
  }

  redo(): void {
    this.dispatch({ type: 'redo' });
  }
}
