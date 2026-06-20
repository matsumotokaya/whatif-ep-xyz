"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

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

export function SavedWorksProvider({
  initialSavedIds,
  children,
}: {
  initialSavedIds: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(initialSavedIds)
  );

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
