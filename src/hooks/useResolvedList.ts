"use client";

import { useEffect, useState } from "react";

// Resolves a server-streamed Promise<string[]> on the client WITHOUT suspending.
// Returns an empty array until the promise settles, then the resolved value.
// Used for non-critical, user-specific data (saved ids, purchased codes) so the
// catalog renders instantly and these highlights fill in once available.
export function useResolvedList(
  promise: Promise<string[]> | undefined
): string[] {
  const [value, setValue] = useState<string[]>([]);

  useEffect(() => {
    if (!promise) return;
    let active = true;
    // Server-streamed promises are React thenables, not native Promises, so the
    // chained `.then().catch()` form can break. Use the two-argument then().
    promise.then(
      (resolved) => {
        if (active) setValue(resolved);
      },
      () => {
        if (active) setValue([]);
      }
    );
    return () => {
      active = false;
    };
  }, [promise]);

  return value;
}
