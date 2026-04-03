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
        eyebrow="Protected library"
        title="The Club Library"
        description="This area is reserved for premium members using the shared WHATIF account system."
      >
        <ClubAccessNotice status={access.status} nextPath="/the-club/library" />
      </ClubShell>
    );
  }

  const items = await getClubItems();
  const stats = await getClubStats();

  return (
    <ClubShell
      eyebrow="Premium library"
      title="The Club Library"
      description="Premium members can browse the catalog and download each item via a private link."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-surface/70 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">{access.displayName}</p>
          <p className="mt-1 text-sm text-muted">
            {access.profile?.subscription_status ?? "subscription status unavailable"}
          </p>
        </div>
        <Link
          href="/the-club"
          className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-muted hover:bg-surface"
        >
          Club home
        </Link>
      </div>

      <ClubStatsRow
        items={[
          { label: "Entries", value: String(stats.total) },
          { label: "Wallpapers", value: String(stats.wallpapers) },
          { label: "State", value: "Premium gated" },
        ]}
      />

      <section className="grid gap-5">
        {items.map((item) => (
          <ClubItemCard key={item.slug} item={item} />
        ))}
      </section>
    </ClubShell>
  );
}
