import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEpisodeByNumber,
  getAdjacentEpisodes,
  getAllEpisodes,
} from "@/lib/episodes";
import { getOriginalUrl } from "@/lib/images";

interface EpisodePageProps {
  params: Promise<{ number: string }>;
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { number } = await params;
  const episode = getEpisodeByNumber(number);
  if (!episode) return { title: "Not Found" };

  return {
    title: `Episode ${episode.number}`,
    description: `${episode.title} - ${episode.category}`,
  };
}

export function generateStaticParams() {
  return getAllEpisodes().map((ep) => ({ number: ep.number }));
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { number } = await params;
  const episode = getEpisodeByNumber(number);
  if (!episode) notFound();

  const { prev, next } = getAdjacentEpisodes(episode.id);
  const imageUrl = getOriginalUrl(episode.number);

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-0">
        <div className="relative flex min-h-[50vh] items-center justify-center bg-surface/50 lg:min-h-screen">
          <div className="relative h-full w-full">
            <Image
              src={imageUrl}
              alt={episode.title}
              fill
              sizes="100vw"
              className="object-contain p-2 sm:p-4 lg:p-8"
              priority
            />
          </div>
        </div>

        <aside className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-sm lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-t-0 lg:bg-background">
          <div className="flex h-full flex-col px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href="/episodes"
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-neon-cyan transition-colors"
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
              Episodes
            </Link>

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
            </div>

            <div className="mt-4 flex flex-col gap-4">
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

              <div className="flex items-center justify-between border-t border-border pt-4">
                {prev ? (
                  <Link
                    href={`/episodes/${prev.number}`}
                    className="flex items-center gap-2 text-sm text-muted hover:text-neon-cyan transition-colors"
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
                  <div />
                )}
                {next ? (
                  <Link
                    href={`/episodes/${next.number}`}
                    className="flex items-center gap-2 text-sm text-muted hover:text-neon-cyan transition-colors"
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
                  <div />
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
