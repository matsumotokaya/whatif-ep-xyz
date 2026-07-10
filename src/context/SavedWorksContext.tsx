"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useResolvedList } from "@/hooks/useResolvedList";

interface SavedWorksContextValue {
  // True when the given work id is in the saved set.
  isSaved: (workId: string) => boolean;
  // Optimistically toggles the saved state and persists to Supabase. Returns
  // early without writing when there is no signed-in user (callers detect the
  // unauthenticated case via useAuth and redirect to login themselves).
  toggle: (workId: string) => Promise<void>;
}

const SavedWorksContext = createContext<SavedWorksContextValue | undefined>(
  undefined
);

const EMPTY_IDS: string[] = [];

export function SavedWorksProvider({
  initialSavedIds = EMPTY_IDS,
  initialSavedIdsPromise,
  hydrateUrl,
  children,
}: {
  /** Resolved saved ids (used when known synchronously). */
  initialSavedIds?: string[];
  /**
   * Streamed saved ids. When provided, ids are resolved on the client without
   * blocking render and merged into the set once available.
   */
  initialSavedIdsPromise?: Promise<string[]>;
  /** Optional client-side endpoint for hydrating saved ids after first paint. */
  hydrateUrl?: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const streamedIds = useResolvedList(initialSavedIdsPromise);
  const resolvedInitial = initialSavedIdsPromise ? streamedIds : initialSavedIds;
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(initialSavedIds)
  );

  // resolvedInitial may arrive after first render when streamed from the server
  // (gallery list / detail pages). Merge late-arriving server ids into the set
  // so saved highlights fill in, without dropping any optimistic client toggles.
  const mergedKey = resolvedInitial.join(",");
  const prevKeyRef = useRef(mergedKey);
  useEffect(() => {
    if (prevKeyRef.current === mergedKey) return;
    prevKeyRef.current = mergedKey;
    if (resolvedInitial.length === 0) return;
    setSavedIds((prev) => {
      const next = new Set(prev);
      for (const id of resolvedInitial) next.add(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedKey]);

  useEffect(() => {
    if (!hydrateUrl) return;
    let active = true;

    void fetch(hydrateUrl, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!active || !payload || typeof payload !== "object") return;
        const ids = (payload as { savedWorkIds?: unknown }).savedWorkIds;
        if (!Array.isArray(ids)) return;
        setSavedIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (typeof id === "string") next.add(id);
          }
          return next;
        });
      })
      .catch(() => {
        // User-specific highlights are progressive enhancement; keep the
        // catalog usable when the background request is unavailable.
      });

    return () => {
      active = false;
    };
  }, [hydrateUrl]);

  const isSaved = useCallback(
    (workId: string) => savedIds.has(workId),
    [savedIds]
  );

  const toggle = useCallback(
    async (workId: string) => {
      // No user: do not write. The SaveButton handles the login redirect.
      if (!user) return;

      const wasSaved = savedIds.has(workId);

      // Optimistic update: mutate the set immediately.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) {
          next.delete(workId);
        } else {
          next.add(workId);
        }
        return next;
      });

      const supabase = createClient();
      const { error } = wasSaved
        ? await supabase
            .from("work_saves")
            .delete()
            .eq("user_id", user.id)
            .eq("work_id", workId)
        : await supabase
            .from("work_saves")
            .insert({ user_id: user.id, work_id: workId });

      if (error) {
        // Revert the optimistic change on failure.
        console.error("toggle saved work failed:", error.message);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) {
            next.add(workId);
          } else {
            next.delete(workId);
          }
          return next;
        });
      }
    },
    [user, savedIds]
  );

  return (
    <SavedWorksContext.Provider value={{ isSaved, toggle }}>
      {children}
    </SavedWorksContext.Provider>
  );
}

export function useSavedWorks(): SavedWorksContextValue {
  const context = useContext(SavedWorksContext);
  if (!context) {
    throw new Error("useSavedWorks must be used within a SavedWorksProvider");
  }
  return context;
}
