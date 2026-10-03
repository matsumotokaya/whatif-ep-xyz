// Share the original, decoded bitmap between canvas layers and status UI.
// Keep it only while mounted consumers exist; large images must not accumulate.
export type EditorImageState =
  | { status: 'loading' | 'error'; image: null }
  | { status: 'loaded'; image: HTMLImageElement };
const LOADING: EditorImageState = { status: 'loading', image: null };
const ERROR: EditorImageState = { status: 'error', image: null };
interface Resource {
  state: EditorImageState;
  listeners: Set<() => void>;
  cancel: () => void;
}
const resources = new Map<string, Resource>();

function start(src: string, resource: Resource) {
  resource.cancel();
  resource.state = LOADING;
  let active = true;
  const image = new Image();
  resource.cancel = () => {
    active = false;
    image.onload = null;
    image.onerror = null;
    if (resource.state.status === 'loading') image.removeAttribute('src');
  };
  const finish = (state: EditorImageState) => {
    if (!active) return;
    resource.state = state;
    resource.listeners.forEach(listener => listener());
  };
  image.decoding = 'async';
  if (!src.startsWith('blob:') && !src.startsWith('data:')) image.crossOrigin = 'anonymous';
  image.onerror = () => finish(ERROR);
  image.onload = async () => {
    try {
      await image.decode();
      finish({ status: 'loaded', image });
    } catch {
      finish(ERROR);
    }
  };
  if (src) image.src = src;
  else finish(ERROR);
}

export function getEditorImageState(src: string): EditorImageState {
  return resources.get(src)?.state ?? LOADING;
}
export const getServerImageState = () => LOADING;

export function subscribeEditorImage(src: string, listener: () => void) {
  let resource = resources.get(src);
  if (!resource) {
    resource = { state: LOADING, listeners: new Set(), cancel: () => {} };
    resources.set(src, resource);
    start(src, resource);
  }
  const current = resource;
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    // React Strict Mode briefly unsubscribes before subscribing again.
    queueMicrotask(() => {
      if (current.listeners.size || resources.get(src) !== current) return;
      current.cancel();
      resources.delete(src);
    });
  };
}

export function retryEditorImage(src: string) {
  const resource = resources.get(src);
  if (!resource || resource.state.status !== 'error') return;
  start(src, resource);
  resource.listeners.forEach(listener => listener());
}
