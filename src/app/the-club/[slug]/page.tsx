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
        eyebrow="Protected"
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
      eyebrow="The Club"
      title={item.title}
      description="Premium members can download this item via a private, signed link."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-4">
        <p className="text-sm text-muted">
          Signed in as{" "}
          <span className="text-foreground">{access.displayName}</span>
        </p>
        <Link
          href="/the-club/library"
          className="inline-flex items-center rounded-lg border border-border px-5 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
        >
          Back to library
        </Link>
      </div>

      <ClubStatsRow
        items={[
          { label: "File", value: item.fileName },
          { label: "Size", value: item.fileSizeLabel },
        ]}
      />

      <ClubDetailPanel item={item} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-4">
        <p className="text-sm text-muted">
          Downloads are delivered via a private, signed URL.
        </p>
        <a
          href={`/api/the-club/download/${item.slug}`}
          className="inline-flex items-center rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
        >
          Download
        </a>
      </div>
    </ClubShell>
  );
}
