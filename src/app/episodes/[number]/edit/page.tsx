import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import type { EpisodeRow } from "@/lib/types";
import { EditEpisodeForm } from "./EditEpisodeForm";

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

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <EditEpisodeForm
          episode={{
            id: episode.id,
            number: episode.number,
            title: episode.title,
            category: episode.category,
            productUrl: episode.product_url,
            releasedOn: episode.released_on,
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
