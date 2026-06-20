"use client";

import { useEffect, useState } from "react";

// Resolves a server-streamed Promise<boolean> on the client WITHOUT suspending.
// Returns false until the promise settles, then the resolved value. Used for
// non-critical, user-specific flags (admin, purchased) so the page renders
// instantly and these affordances appear once available.
export function useResolvedFlag(promise: Promise<boolean> | undefined): boolean {
  const [value, setValue] = useState(false);

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
        if (active) setValue(false);
      }
    );
    return () => {
      active = false;
    };
  }, [promise]);

  return value;
}
