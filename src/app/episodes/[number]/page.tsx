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
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/episodes"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-neon-cyan transition-colors"
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

      {/* Image */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
        <div className="relative aspect-square max-h-[80vh] w-full">
          <Image
            src={imageUrl}
            alt={episode.title}
            fill
            sizes="(max-width: 768px) 100vw, 80vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-neon-cyan text-lg">
            #{episode.number}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{episode.title}</h1>
          {episode.category && (
            <p className="mt-2 text-sm text-muted">{episode.category}</p>
          )}
        </div>

        {episode.productUrl && (
          <a
            href={episode.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10 px-4 py-2 text-sm font-medium text-neon-magenta transition-all hover:bg-neon-magenta/20 hover:shadow-[0_0_15px_rgba(255,0,229,0.2)]"
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

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        {prev ? (
          <Link
            href={`/episodes/${prev.number}`}
            className="flex items-center gap-2 text-sm text-muted hover:text-neon-cyan transition-colors"
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
          <div />
        )}
        {next ? (
          <Link
            href={`/episodes/${next.number}`}
            className="flex items-center gap-2 text-sm text-muted hover:text-neon-cyan transition-colors"
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
          <div />
        )}
      </div>
    </div>
  );
}
