import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEpisodeByNumber,
  getAdjacentEpisodes,
} from "@/lib/episodes";
import { getAdminAccess } from "@/lib/admin/access";
import { getOriginalUrl } from "@/lib/images";
import { EpisodeDetailImage } from "@/components/EpisodeDetailImage";
import { EpisodeDownloadButton } from "@/components/EpisodeDownloadButton";
import { EpisodeMobileInfo } from "@/components/EpisodeMobileInfo";

interface EpisodePageProps {
  params: Promise<{ number: string }>;
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { number } = await params;
  const episode = await getEpisodeByNumber(number);
  if (!episode) return { title: "Not Found" };

  return {
    title: `Episode ${episode.number}`,
    description: `${episode.title} - ${episode.category}`,
  };
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function resolveDownloadExtension(storageKey: string): "png" | "jpg" | "webp" {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".webp")) return "webp";
  return "png";
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { number } = await params;
  const episode = await getEpisodeByNumber(number);
  if (!episode) notFound();

  const { prev, next } = await getAdjacentEpisodes(episode.id);
  const adminAccess = await getAdminAccess();
  const imageUrl = getOriginalUrl(episode);
  const releasedOn = formatDate(episode.createdAt);
  const updatedOn = formatDate(episode.updatedAt);
  const publishedOn = formatDate(episode.publishedAt);
  const downloadFilename = `whatif-${episode.number}.${resolveDownloadExtension(episode.originalStorageKey)}`;
  const downloadUrl = `/api/episodes/${episode.number}/download?filename=${encodeURIComponent(downloadFilename)}`;

  const dates = [
    releasedOn && { label: "Released", value: releasedOn },
    updatedOn && { label: "Updated", value: updatedOn },
    publishedOn && { label: "Published", value: publishedOn },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
        {/* Image area */}
        <div className="relative min-h-0 bg-surface/30">
          <EpisodeDetailImage src={imageUrl} alt={episode.title} />

          {/* Mobile bottom bar */}
          <div className="absolute inset-x-0 bottom-0 lg:hidden">
            <div className="mx-3 mb-3 rounded-2xl border border-border bg-background/90 backdrop-blur-lg shadow-lg">
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted">
                      #{episode.number}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {episode.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EpisodeDownloadButton
                      url={downloadUrl}
                      filename={downloadFilename}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-surface-hover"
                    >
                      Download
                    </EpisodeDownloadButton>
                    <EpisodeMobileInfo
                      episode={episode}
                      dates={dates}
                      isAdmin={adminAccess.isAdmin}
                      downloadUrl={downloadUrl}
                      downloadFilename={downloadFilename}
                    />
                  </div>
                </div>

                {/* Prev / Gallery / Next */}
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  {prev ? (
                    <Link
                      href={`/episodes/${prev.number}`}
                      className="group inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
                    >
                      <svg
                        className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      #{prev.number}
                    </Link>
                  ) : (
                    <span className="text-muted/30">Prev</span>
                  )}

                  <Link
                    href="/episodes"
                    className="btn-press rounded-full border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    Episodes
                  </Link>

                  {next ? (
                    <Link
                      href={`/episodes/${next.number}`}
                      className="group inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
                    >
                      #{next.number}
                      <svg
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ) : (
                    <span className="text-muted/30">Next</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden flex-col border-t border-border bg-background/95 backdrop-blur-sm lg:flex lg:border-l lg:border-t-0">
          <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
            <div className="flex-1">
              <p className="font-mono text-lg text-muted">
                #{episode.number}
              </p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">
                {episode.title}
              </h1>
              {episode.category && (
                <p className="mt-2 text-sm text-muted">{episode.category}</p>
              )}

              <dl className="mt-6 grid gap-4 text-xs sm:grid-cols-2">
                {dates.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 text-foreground">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    Status
                  </dt>
                  <dd className="mt-1 text-foreground">
                    <span
                      className={`inline-flex items-center gap-1.5 ${episode.isPublished ? "text-foreground" : "text-muted"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${episode.isPublished ? "bg-foreground" : "bg-muted/50"}`}
                      />
                      {episode.isPublished ? "Published" : "Draft"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-2.5">
              {adminAccess.isAdmin && (
                <Link
                  href={`/episodes/${episode.number}/edit`}
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  Edit
                </Link>
              )}
              <EpisodeDownloadButton
                url={downloadUrl}
                filename={downloadFilename}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
              >
                Download
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v10m0 0l-4-4m4 4l4-4m-8 8h8"
                  />
                </svg>
              </EpisodeDownloadButton>
              {episode.productUrl && (
                <a
                  href={episode.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  Buy Wallpaper
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Desktop prev/next nav */}
          <div className="border-t border-border px-6 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              {prev ? (
                <Link
                  href={`/episodes/${prev.number}`}
                  className="group inline-flex items-center gap-2 text-muted transition-colors hover:text-foreground"
                >
                  <svg
                    className="h-4 w-4 transition-transform group-hover:-translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  #{prev.number}
                </Link>
              ) : (
                <span className="text-muted/30">Prev</span>
              )}

              <Link
                href="/episodes"
                className="btn-press inline-flex items-center justify-center rounded-full border border-border px-4 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                Episodes
              </Link>

              {next ? (
                <Link
                  href={`/episodes/${next.number}`}
                  className="group inline-flex items-center gap-2 text-muted transition-colors hover:text-foreground"
                >
                  #{next.number}
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ) : (
                <span className="text-muted/30">Next</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
