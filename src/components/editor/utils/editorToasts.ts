// Transient notices for the editor (upload progress, export hints, failures).
// A module-level store so any editor code can report something without
// threading a callback through every component, and so nothing blocks the
// page the way alert() does.

export type EditorToastTone = 'info' | 'error' | 'progress';

export interface EditorToast {
  id: number;
  message: string;
  tone: EditorToastTone;
}

const DEFAULT_DURATION_MS = 5000;
const ERROR_DURATION_MS = 8000;

let toasts: EditorToast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(next: EditorToast[]): void {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function subscribeEditorToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEditorToasts(): EditorToast[] {
  return toasts;
}

export function dismissEditorToast(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  if (toasts.some((toast) => toast.id === id)) {
    emit(toasts.filter((toast) => toast.id !== id));
  }
}

// Show a notice. 'progress' notices stay until the returned function is
// called; the others dismiss themselves.
export function showEditorToast(message: string, tone: EditorToastTone = 'info'): () => void {
  const id = nextId++;
  emit([...toasts, { id, message, tone }]);

  if (tone !== 'progress') {
    timers.set(
      id,
      setTimeout(() => dismissEditorToast(id), tone === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS),
    );
  }
  return () => dismissEditorToast(id);
}
