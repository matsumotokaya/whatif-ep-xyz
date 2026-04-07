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
  const downloadFilename = `whatif-${episode.number}.png`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
        <div className="relative min-h-0 bg-surface/50">
          <EpisodeDetailImage src={imageUrl} alt={episode.title} />
          <div className="absolute inset-x-0 bottom-0 lg:hidden">
            <div className="mx-3 mb-3 rounded-2xl border border-border bg-background/85 backdrop-blur-md">
              <div className="px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-neon-cyan">
                      #{episode.number}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {episode.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EpisodeDownloadButton
                      url={imageUrl}
                      filename={downloadFilename}
                      className="inline-flex items-center justify-center rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-1 text-[11px] font-medium text-neon-cyan"
                    >
                      Download
                    </EpisodeDownloadButton>
                    <details className="group">
                      <summary className="cursor-pointer list-none rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-neon-cyan/60 hover:text-neon-cyan">
                        <span className="group-open:hidden">Info</span>
                        <span className="hidden group-open:inline">Close</span>
                      </summary>
                    <div className="mt-3 rounded-xl border border-border/60 bg-background/95 p-3 text-xs text-muted shadow-lg">
                      <dl className="grid grid-cols-2 gap-3 text-[11px]">
                        {releasedOn && (
                          <div>
                            <dt className="uppercase tracking-[0.2em] text-[9px] text-muted/70">
                              投稿日
                            </dt>
                            <dd className="mt-1 text-foreground">
                              {releasedOn}
                            </dd>
                          </div>
                        )}
                        {updatedOn && (
                          <div>
                            <dt className="uppercase tracking-[0.2em] text-[9px] text-muted/70">
                              更新日
                            </dt>
                            <dd className="mt-1 text-foreground">
                              {updatedOn}
                            </dd>
                          </div>
                        )}
                        {publishedOn && (
                          <div>
                            <dt className="uppercase tracking-[0.2em] text-[9px] text-muted/70">
                              公開日
                            </dt>
                            <dd className="mt-1 text-foreground">
                              {publishedOn}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="uppercase tracking-[0.2em] text-[9px] text-muted/70">
                            公開状態
                          </dt>
                          <dd className="mt-1 text-foreground">
                            {episode.isPublished ? "公開中" : "非公開"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {adminAccess.isAdmin && (
                          <Link
                            href={`/episodes/${episode.number}/edit`}
                            className="inline-flex items-center justify-center rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-1.5 text-[11px] font-medium text-neon-cyan"
                          >
                            編集する
                          </Link>
                        )}
                        {episode.productUrl && (
                          <a
                            href={episode.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full border border-neon-magenta/50 bg-neon-magenta/10 px-3 py-1.5 text-[11px] font-medium text-neon-magenta"
                          >
                            Buy
                          </a>
                        )}
                      </div>
                    </div>
                    </details>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  {prev ? (
                    <Link
                      href={`/episodes/${prev.number}`}
                      className="inline-flex items-center gap-1 text-muted hover:text-neon-cyan transition-colors"
                    >
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
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      #{prev.number}
                    </Link>
                  ) : (
                    <span className="text-muted/40">Prev</span>
                  )}

                  <Link
                    href="/episodes"
                    className="rounded-full border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted hover:border-neon-cyan/60 hover:text-neon-cyan transition-colors"
                  >
                    Episodes
                  </Link>

                  {next ? (
                    <Link
                      href={`/episodes/${next.number}`}
                      className="inline-flex items-center gap-1 text-muted hover:text-neon-cyan transition-colors"
                    >
                      #{next.number}
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ) : (
                    <span className="text-muted/40">Next</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden flex-col border-t border-border bg-background/95 backdrop-blur-sm lg:flex lg:border-l lg:border-t-0">
          <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex-1">
              <p className="font-mono text-neon-cyan text-lg">
                #{episode.number}
              </p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">
                {episode.title}
              </h1>
              {episode.category && (
                <p className="mt-2 text-sm text-muted">{episode.category}</p>
              )}
              <dl className="mt-4 grid gap-3 text-xs text-muted sm:grid-cols-2">
                {releasedOn && (
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-[10px] text-muted/70">
                      投稿日
                    </dt>
                    <dd className="mt-1 text-foreground">{releasedOn}</dd>
                  </div>
                )}
                {updatedOn && (
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-[10px] text-muted/70">
                      更新日
                    </dt>
                    <dd className="mt-1 text-foreground">{updatedOn}</dd>
                  </div>
                )}
                {publishedOn && (
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-[10px] text-muted/70">
                      公開日
                    </dt>
                    <dd className="mt-1 text-foreground">{publishedOn}</dd>
                  </div>
                )}
                <div>
                  <dt className="uppercase tracking-[0.2em] text-[10px] text-muted/70">
                    公開状態
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {episode.isPublished ? "公開中" : "非公開"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {adminAccess.isAdmin && (
                <Link
                  href={`/episodes/${episode.number}/edit`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/50 bg-neon-cyan/10 px-4 py-3 text-sm font-medium text-neon-cyan transition-all hover:bg-neon-cyan/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                >
                  編集する
                </Link>
              )}
              <EpisodeDownloadButton
                url={imageUrl}
                filename={downloadFilename}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-hover px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10 px-4 py-3 text-sm font-medium text-neon-magenta transition-all hover:bg-neon-magenta/20 hover:shadow-[0_0_15px_rgba(255,0,229,0.2)]"
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

          <div className="border-t border-border px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 text-sm">
              {prev ? (
                <Link
                  href={`/episodes/${prev.number}`}
                  className="inline-flex items-center gap-2 text-muted hover:text-neon-cyan transition-colors"
                >
                  <svg
                    className="h-5 w-5"
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
                <span className="text-muted/40">Prev</span>
              )}

              <Link
                href="/episodes"
                className="inline-flex items-center justify-center rounded-full border border-border px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted hover:border-neon-cyan/60 hover:text-neon-cyan transition-colors"
              >
                Episodes
              </Link>

              {next ? (
                <Link
                  href={`/episodes/${next.number}`}
                  className="inline-flex items-center gap-2 text-muted hover:text-neon-cyan transition-colors"
                >
                  #{next.number}
                  <svg
                    className="h-5 w-5"
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
                <span className="text-muted/40">Next</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
