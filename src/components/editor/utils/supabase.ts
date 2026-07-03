// Editor-side Supabase access.
//
// Delegates to the Gallery browser client (src/lib/supabase/client.ts,
// @supabase/ssr) so the editor island shares the single-origin session with
// the rest of the app instead of creating a second GoTrue instance.
//
// The async getSupabase() signature is preserved from IMAGINE so the ported
// call sites (`const supabase = await getSupabase()`) stay unchanged.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

export const getSupabase = async (): Promise<SupabaseClient> => {
  // createBrowserClient caches a singleton internally.
  return createClient() as SupabaseClient;
};

export const getSupabaseStoragePublicUrl = (bucket: string, storagePath: string) => {
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
};
