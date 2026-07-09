import "server-only";

import { createClient } from "@/lib/supabase/server";

// Returns all saved work ids for the signed-in user. If no user, returns [].
//
// Note on the seriesSlug param: rather than join work_saves -> works to filter
// by series server-side, we return ALL of the user's saved work ids and let the
// gallery page intersect them with the series works it already has in memory.
// This is the simplest correct approach: the saved set is small (per-user
// bookmarks), and the caller already knows which works belong to the series.
// The param is accepted for call-site clarity but does not change the result.
export async function getSavedWorkIds(
): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("work_saves")
    .select("work_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("getSavedWorkIds query failed:", error.message);
    return [];
  }

  const rows = (data as { work_id: string | null }[] | null) ?? [];
  return [
    ...new Set(
      rows
        .map((row) => row.work_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
}
