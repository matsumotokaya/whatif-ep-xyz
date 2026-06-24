import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import type { EpisodeRow } from "@/lib/types";
import { EditEpisodeForm } from "./EditEpisodeForm";

function isMissingWorkTagTableError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    message.includes("Could not find the table 'public.work_tag_map'") ||
    message.includes("Could not find the table 'public.work_tags'")
  );
}

interface EditEpisodePageProps {
  params: Promise<{ number: string }>;
}

export const metadata: Metadata = {
  title: "Edit Episode",
  description: "Edit a WHATIF episode",
};

export const runtime = "nodejs";

export default async function EditEpisodePage({
  params,
}: EditEpisodePageProps) {
  const { number } = await params;
  await requireAdmin(`/episodes/${number}/edit`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episodes")
    .select(
      [
        "id",
        "number",
        "title",
        "category",
        "product_url",
        "released_on",
        "original_storage_key",
        "thumbnail_storage_key",
        "is_published",
        "published_at",
      ].join(", ")
    )
    .eq("number", number)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const episode = data as unknown as EpisodeRow;
  const { data: workData, error: workError } = await supabase
    .from("works")
    .select("id, title, theme_category, summary, released_on")
    .eq("legacy_episode_id", episode.id)
    .maybeSingle();

  if (workError) {
    notFound();
  }

  let workTags: string[] = [];
  if (workData?.id) {
    const { data: tagMapData, error: tagMapError } = await supabase
      .from("work_tag_map")
      .select("tag_id")
      .eq("work_id", workData.id);

    if (tagMapError && !isMissingWorkTagTableError(tagMapError)) {
      notFound();
    }

    const tagIds = (tagMapData ?? []).map((row) => row.tag_id as string);
    if (tagIds.length > 0) {
      const { data: tagData, error: tagError } = await supabase
        .from("work_tags")
        .select("id, label")
        .in("id", tagIds);

      if (tagError && !isMissingWorkTagTableError(tagError)) {
        notFound();
      }

      workTags = (tagData ?? [])
        .map((tag) => tag.label as string)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
  }

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <EditEpisodeForm
          episode={{
            id: episode.id,
            number: episode.number,
            title: (workData?.title as string | undefined) ?? episode.title,
            category:
              (workData?.theme_category as string | undefined) ?? episode.category,
            summary: (workData?.summary as string | null | undefined) ?? null,
            workTags,
            productUrl: episode.product_url,
            releasedOn:
              (workData?.released_on as string | null | undefined) ??
              episode.released_on,
            originalStorageKey: episode.original_storage_key,
            thumbnailStorageKey: episode.thumbnail_storage_key,
            isPublished: episode.is_published,
            publishedAt: episode.published_at,
          }}
        />
      </div>
    </div>
  );
}
