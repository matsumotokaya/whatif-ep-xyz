import type { Metadata } from "next";
import Link from "next/link";
import {
  ClubAccessNotice,
  ClubItemCard,
  ClubShell,
  ClubStatsRow,
} from "../_components";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import { getClubItems, getClubStats } from "@/lib/club/catalog";

export const metadata: Metadata = {
  title: "The Club Library",
  description: "Premium The Club download library",
};

export default async function ClubLibraryPage() {
  const access = await getClubAccess();

  if (!canAccessClub(access)) {
    return (
      <ClubShell
        eyebrow="Protected"
        title="Library"
        description="This area is reserved for premium members."
      >
        <ClubAccessNotice status={access.status} nextPath="/the-club/library" />
      </ClubShell>
    );
  }

  const items = await getClubItems();
  const stats = await getClubStats();

  return (
    <ClubShell
      eyebrow="The Club"
      title="Library"
      description="Browse and download all premium content. Each item is delivered via a private link."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {access.displayName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {access.profile?.subscription_status ?? "Premium"}
          </p>
        </div>
        <Link
          href="/the-club"
          className="inline-flex items-center rounded-lg border border-border px-5 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
        >
          Club home
        </Link>
      </div>

      <ClubStatsRow
        items={[
          { label: "Entries", value: String(stats.total) },
          { label: "Wallpapers", value: String(stats.wallpapers) },
        ]}
      />

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ClubItemCard key={item.slug} item={item} />
        ))}
      </section>
    </ClubShell>
  );
}
