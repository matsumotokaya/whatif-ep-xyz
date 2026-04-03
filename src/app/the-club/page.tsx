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
      description="A premium library for WHATIF members. The first version keeps the shared account system intact and opens the club to authenticated premium users."
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-border bg-surface/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-neon-cyan/80">
            Current access
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">
            {access.status === "anonymous"
              ? "Sign in with your WHATIF account"
              : premium
                ? `Welcome back, ${access.displayName}`
                : "Your account is active, but premium is required"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            The Club will share the same account identity as the rest of the
            WHATIF service. That keeps the user model consistent while the club
            content and private assets are moved in later.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {access.status === "anonymous" ? (
              <Link
                href="/auth/login?next=%2Fthe-club"
                className="inline-flex items-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-5 py-3 text-sm font-medium text-neon-cyan transition-colors hover:bg-neon-cyan/15"
              >
                Log in
              </Link>
            ) : (
              <Link
                href="/the-club/library"
                className="inline-flex items-center rounded-full border border-neon-magenta/40 bg-neon-magenta/10 px-5 py-3 text-sm font-medium text-neon-magenta transition-colors hover:bg-neon-magenta/15"
              >
                Open library
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-muted hover:bg-surface"
            >
              Back to gallery
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface/70 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-neon-magenta/80">
            What is ready
          </p>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-muted">
            <p>Shared account system with premium gating.</p>
            <p>Library and detail pages built for private asset delivery.</p>
            <p>Cloudflare private storage is connected for signed downloads.</p>
          </div>
        </div>
      </section>

      <ClubStatsRow
        items={[
          { label: "Catalog entries", value: String(stats.total) },
          { label: "Wallpaper sets", value: String(stats.wallpapers) },
          { label: "Scaffold state", value: stats.ready > 0 ? "Ready" : "Pending" },
        ]}
      />
    </ClubShell>
  );
}
