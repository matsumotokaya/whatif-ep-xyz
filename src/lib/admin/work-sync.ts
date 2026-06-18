import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface EpisodeSyncPayload {
  id: number;
  number: string;
  title: string;
  category: string;
  product_url: string | null;
  released_on: string | null;
  original_storage_key: string;
  thumbnail_storage_key: string | null;
  is_published: boolean;
  published_at: string | null;
}

export async function syncEpisodeWork(
  supabase: SupabaseServerClient,
  payload: EpisodeSyncPayload
) {
  const { data: series, error: seriesError } = await supabase
    .from("work_series")
    .select("id")
    .eq("slug", "episode")
    .single();

  if (seriesError || !series) {
    throw new Error(`Failed to resolve work series: ${seriesError?.message ?? "episode series missing"}`);
  }

  const publishedAt =
    payload.is_published
      ? payload.published_at ?? new Date().toISOString()
      : null;

  const { error: workError } = await supabase.from("works").upsert(
    {
      series_id: series.id,
      legacy_episode_id: payload.id,
      sequence_number: payload.id,
      display_code: payload.number,
      slug: `episode-${payload.number}`,
      title: payload.title,
      theme_category: payload.category,
      released_on: payload.released_on,
      status: payload.is_published ? "published" : "draft",
      published_at: publishedAt,
    },
    {
      onConflict: "legacy_episode_id",
    }
  );

  if (workError) {
    throw new Error(`Failed to sync work record: ${workError.message}`);
  }

  const { data: work, error: workFetchError } = await supabase
    .from("works")
    .select("id")
    .eq("legacy_episode_id", payload.id)
    .single();

  if (workFetchError || !work) {
    throw new Error(`Failed to load synced work: ${workFetchError?.message ?? "work missing"}`);
  }

  const { error: variantError } = await supabase.from("work_variants").upsert(
    {
      work_id: work.id,
      variant_number: 1,
      display_code: `${payload.number}-1`,
      title: payload.title,
      variant_type: "image",
      original_storage_key: payload.original_storage_key,
      thumbnail_storage_key: payload.thumbnail_storage_key,
      status: payload.is_published ? "ready" : "hidden",
      sort_order: 1,
      is_primary: true,
    },
    {
      onConflict: "work_id,variant_number",
    }
  );

  if (variantError) {
    throw new Error(`Failed to sync primary variant: ${variantError.message}`);
  }

  const { data: variant, error: variantFetchError } = await supabase
    .from("work_variants")
    .select("id")
    .eq("work_id", work.id)
    .eq("variant_number", 1)
    .single();

  if (variantFetchError || !variant) {
    throw new Error(`Failed to load synced variant: ${variantFetchError?.message ?? "variant missing"}`);
  }

  const { data: existingStoreOffer, error: existingStoreOfferError } = await supabase
    .from("work_offers")
    .select("id")
    .eq("variant_id", variant.id)
    .eq("offer_type", "store_product")
    .maybeSingle();

  if (existingStoreOfferError) {
    throw new Error(`Failed to inspect store offer: ${existingStoreOfferError.message}`);
  }

  if (payload.product_url) {
    if (existingStoreOffer?.id) {
      const { error } = await supabase
        .from("work_offers")
        .update({
          work_id: work.id,
          variant_id: variant.id,
          plan_type: "paid",
          status: payload.is_published ? "ready" : "hidden",
          title: "Legacy store item",
          description: "Imported from public.episodes.product_url",
          target_url: payload.product_url,
          sort_order: 1,
        })
        .eq("id", existingStoreOffer.id);

      if (error) {
        throw new Error(`Failed to update store offer: ${error.message}`);
      }
    } else {
      const { error } = await supabase.from("work_offers").insert({
        work_id: work.id,
        variant_id: variant.id,
        offer_type: "store_product",
        plan_type: "paid",
        status: payload.is_published ? "ready" : "hidden",
        title: "Legacy store item",
        description: "Imported from public.episodes.product_url",
        target_url: payload.product_url,
        sort_order: 1,
      });

      if (error) {
        throw new Error(`Failed to create store offer: ${error.message}`);
      }
    }
  } else if (existingStoreOffer?.id) {
    const { error } = await supabase
      .from("work_offers")
      .delete()
      .eq("id", existingStoreOffer.id);

    if (error) {
      throw new Error(`Failed to delete store offer: ${error.message}`);
    }
  }
}

export async function deleteEpisodeWork(
  supabase: SupabaseServerClient,
  episodeId: number
) {
  const { error } = await supabase
    .from("works")
    .delete()
    .eq("legacy_episode_id", episodeId);

  if (error) {
    throw new Error(`Failed to delete synced work: ${error.message}`);
  }
}
