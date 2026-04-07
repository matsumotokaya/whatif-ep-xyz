import type { Metadata } from "next";
import Link from "next/link";
import { ClubShell, ClubStatsRow } from "./_components";
import { getClubAccess, canAccessClub } from "@/lib/club/access";
import { getClubStats } from "@/lib/club/catalog";

export const metadata: Metadata = {
  title: "The Club",
  description: "WHATIF EP - The Club member area",
};

export default async function TheClubPage() {
  const access = await getClubAccess();
  const stats = await getClubStats();
  const premium = canAccessClub(access);

  return (
    <ClubShell
      eyebrow="Members only"
      title="The Club"
      description="An exclusive space for WHATIF members. Premium content, wallpapers, and archives — all in one place."
    >
      <section className="rounded-2xl border border-border bg-surface p-8">
        <p className="text-[11px] uppercase tracking-[0.35em] text-muted">
          Access
        </p>
        <h2 className="mt-3 text-2xl font-bold text-foreground">
          {access.status === "anonymous"
            ? "Sign in to continue"
            : premium
              ? `Welcome, ${access.displayName}`
              : "Premium required"}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
          {access.status === "anonymous"
            ? "The Club uses the same WHATIF account you already have. Sign in to check your access."
            : premium
              ? "You have full access to The Club library and all member content."
              : "Your account is active, but premium membership is required to enter The Club."}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {access.status === "anonymous" ? (
            <Link
              href="/auth/login?next=%2Fthe-club"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              Log in
            </Link>
          ) : (
            <Link
              href="/the-club/library"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              Open library
            </Link>
          )}
          <Link
            href="/episodes"
            className="btn-press inline-flex items-center rounded-lg border border-border px-8 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Gallery
          </Link>
        </div>
      </section>

      <ClubStatsRow
        items={[
          { label: "Catalog entries", value: String(stats.total) },
          { label: "Wallpaper sets", value: String(stats.wallpapers) },
        ]}
      />
    </ClubShell>
  );
}
