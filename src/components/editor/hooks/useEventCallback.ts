import { useCallback, useLayoutEffect, useRef } from 'react';

// A callback whose identity never changes but which always runs the latest
// version of `handler`. Lets memoized children (and long-lived listeners)
// receive handlers without re-rendering on every parent render, and without
// ever calling a stale closure.
export function useEventCallback<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
