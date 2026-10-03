import { useCallback, useSyncExternalStore } from 'react';
import { getEditorImageState, getServerImageState, retryEditorImage, subscribeEditorImage } from '../utils/editorImageResource';

export function useEditorImage(src: string) {
  const subscribe = useCallback((listener: () => void) => subscribeEditorImage(src, listener), [src]);
  const snapshot = useCallback(() => getEditorImageState(src), [src]);
  const state = useSyncExternalStore(subscribe, snapshot, getServerImageState);
  const retry = useCallback(() => retryEditorImage(src), [src]);
  return { ...state, retry };
}
