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
    <div className="w-full px-2 py-6 sm:px-4 sm:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight neon-text-cyan">
            Episodes
          </h1>
          <p className="mt-2 text-sm text-muted">{total} episodes</p>
        </div>

        {adminAccess.isAdmin && (
          <Link
            href="/episodes/new"
            className="inline-flex items-center rounded-lg border border-neon-cyan px-4 py-2.5 text-sm font-medium text-neon-cyan transition-colors hover:bg-neon-cyan hover:text-background"
          >
            新しいエピソード追加
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
