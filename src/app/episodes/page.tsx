import type { Metadata } from "next";
import { getAllEpisodes, getTotalCount } from "@/lib/episodes";
import { getAdminAccess } from "@/lib/admin/access";
import { EpisodesPageClient } from "./EpisodesPageClient";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Episodes",
  description: "Browse all WHATIF episodes",
};

export default async function EpisodesPage() {
  const [newestFirst, oldestFirst, total, adminAccess] = await Promise.all([
    getAllEpisodes("newest"),
    getAllEpisodes("oldest"),
    getTotalCount(),
    getAdminAccess(),
  ]);

  return (
    <div className="w-full px-3 py-6 sm:px-5 sm:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Episodes
          </h1>
          <p className="mt-1 text-sm text-muted">{total} episodes</p>
        </div>

        {adminAccess.isAdmin && (
          <Link
            href="/episodes/new"
            className="btn-press inline-flex items-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            Add episode
          </Link>
        )}
      </div>

      <EpisodesPageClient
        newestFirst={newestFirst}
        oldestFirst={oldestFirst}
        total={total}
      />
    </div>
  );
}
