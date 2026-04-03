import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClubAccessNotice,
  ClubDetailPanel,
  ClubShell,
  ClubStatsRow,
} from "../_components";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import { getClubItem } from "@/lib/club/catalog";

interface ClubDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: ClubDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `The Club · ${slug}`,
    description: "Premium The Club download detail",
  };
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { slug } = await params;
  const access = await getClubAccess();

  if (!canAccessClub(access)) {
    return (
      <ClubShell
        eyebrow="Protected detail"
        title="The Club"
        description="This page is only visible to premium members."
      >
        <ClubAccessNotice status={access.status} nextPath={`/the-club/${slug}`} />
      </ClubShell>
    );
  }

  const item = await getClubItem(slug);

  if (!item) {
    notFound();
  }

  return (
    <ClubShell
      eyebrow="Premium detail"
      title={item.title}
      description="Premium members can download this item via a private, signed link."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-surface/70 px-5 py-4">
        <div className="text-sm text-muted">
          <span className="text-foreground">{access.displayName}</span> is viewing
          a premium item.
        </div>
        <Link
          href="/the-club/library"
          className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-muted hover:bg-surface"
        >
          Back to library
        </Link>
      </div>

      <ClubStatsRow
        items={[
          { label: "File", value: item.fileName },
          { label: "Size", value: item.fileSizeLabel },
          { label: "Status", value: item.status === "preview" ? "Preview" : "Soon" },
        ]}
      />

      <ClubDetailPanel item={item} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-surface/70 px-5 py-4">
        <div className="text-sm text-muted">
          Downloads are delivered via a private, signed URL.
        </div>
        <a
          href={`/api/the-club/download/${item.slug}`}
          className="inline-flex items-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-sm font-medium text-neon-cyan transition-colors hover:bg-neon-cyan/15"
        >
          Download
        </a>
      </div>
    </ClubShell>
  );
}
