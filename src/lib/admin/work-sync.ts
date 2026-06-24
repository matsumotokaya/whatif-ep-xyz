import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface EpisodeSyncPayload {
  id: number;
  number: string;
  title: string;
  category: string;
  summary?: string | null;
  work_tags?: string[] | null;
  product_url: string | null;
  released_on: string | null;
  original_storage_key: string;
  thumbnail_storage_key: string | null;
  is_published: boolean;
  published_at: string | null;
}

interface WorkTagRow {
  id: string;
  slug: string;
  label: string;
  tag_type: string;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function slugifyTag(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isMissingWorkTagTableError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    message.includes("Could not find the table 'public.work_tag_map'") ||
    message.includes("Could not find the table 'public.work_tags'")
  );
}

async function syncWorkTags(
  supabase: SupabaseServerClient,
  workId: string,
  tags: string[]
) {
  const normalized = Array.from(
    new Map(
      tags
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => [slugifyTag(label), label] as const)
        .filter(([slug]) => slug.length > 0)
    ).entries()
  ).map(([slug, label]) => ({ slug, label }));

  if (normalized.length === 0) {
    const { error } = await supabase
      .from("work_tag_map")
      .delete()
      .eq("work_id", workId);

    if (error && !isMissingWorkTagTableError(error)) {
      throw new Error(`Failed to clear work tags: ${error.message}`);
    }

    return;
  }

  const { data: existingTagsData, error: existingTagsError } = await supabase
    .from("work_tags")
    .select("id, slug, label, tag_type")
    .in("slug", normalized.map((tag) => tag.slug));

  if (existingTagsError) {
    if (isMissingWorkTagTableError(existingTagsError)) {
      return;
    }

    throw new Error(`Failed to load work tags: ${existingTagsError.message}`);
  }

  const existingTags = (existingTagsData ?? []) as WorkTagRow[];
  const existingBySlug = new Map(existingTags.map((tag) => [tag.slug, tag]));
  const missingTags = normalized.filter((tag) => !existingBySlug.has(tag.slug));

  if (missingTags.length > 0) {
    const { error: insertTagsError } = await supabase.from("work_tags").insert(
      missingTags.map((tag) => ({
        slug: tag.slug,
        label: tag.label,
        tag_type: "general",
      }))
    );

    if (insertTagsError) {
      if (isMissingWorkTagTableError(insertTagsError)) {
        return;
      }

      throw new Error(`Failed to create work tags: ${insertTagsError.message}`);
    }
  }

  const { data: allTagsData, error: allTagsError } = await supabase
    .from("work_tags")
    .select("id, slug, label, tag_type")
    .in("slug", normalized.map((tag) => tag.slug));

  if (allTagsError) {
    if (isMissingWorkTagTableError(allTagsError)) {
      return;
    }

    throw new Error(`Failed to reload work tags: ${allTagsError.message}`);
  }

  const tagIds = ((allTagsData ?? []) as WorkTagRow[]).map((tag) => tag.id);

  const { data: existingMapData, error: existingMapError } = await supabase
    .from("work_tag_map")
    .select("tag_id")
    .eq("work_id", workId);

  if (existingMapError) {
    if (isMissingWorkTagTableError(existingMapError)) {
      return;
    }

    throw new Error(`Failed to load work tag map: ${existingMapError.message}`);
  }

  const existingTagIds = new Set(
    (existingMapData ?? []).map((row) => row.tag_id as string)
  );
  const missingMapRows = tagIds
    .filter((tagId) => !existingTagIds.has(tagId))
    .map((tagId) => ({
      work_id: workId,
      tag_id: tagId,
    }));

  if (missingMapRows.length > 0) {
    const { error: insertMapError } = await supabase
      .from("work_tag_map")
      .insert(missingMapRows);

    if (insertMapError) {
      if (isMissingWorkTagTableError(insertMapError)) {
        return;
      }

      throw new Error(`Failed to save work tag map: ${insertMapError.message}`);
    }
  }

  const staleTagIds = Array.from(existingTagIds).filter(
    (tagId) => !tagIds.includes(tagId)
  );

  if (staleTagIds.length > 0) {
    const { error: deleteMapError } = await supabase
      .from("work_tag_map")
      .delete()
      .eq("work_id", workId)
      .in("tag_id", staleTagIds);

    if (deleteMapError) {
      if (isMissingWorkTagTableError(deleteMapError)) {
        return;
      }

      throw new Error(`Failed to prune work tag map: ${deleteMapError.message}`);
    }
  }
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

  const { data: existingWork } = await supabase
    .from("works")
    .select("id, summary")
    .eq("legacy_episode_id", payload.id)
    .maybeSingle();

  const { error: workError } = await supabase.from("works").upsert(
    {
      series_id: series.id,
      legacy_episode_id: payload.id,
      sequence_number: payload.id,
      display_code: payload.number,
      slug: `episode-${payload.number}`,
      title: payload.title,
      theme_category: payload.category,
      summary:
        payload.summary !== undefined
          ? normalizeOptionalText(payload.summary)
          : existingWork?.summary ?? null,
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

  if (payload.work_tags !== undefined) {
    await syncWorkTags(supabase, work.id, payload.work_tags ?? []);
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
