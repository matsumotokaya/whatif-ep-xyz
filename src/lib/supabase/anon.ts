import "server-only";

import { createClient } from "@supabase/supabase-js";

// Cookie-free anon Supabase client for use inside unstable_cache callbacks.
// Uses NEXT_PUBLIC_SUPABASE_ANON_KEY (no session persistence).
// RLS restricts anon reads to published / public rows; callers also add explicit
// status filters so correctness does not depend solely on RLS.
export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
