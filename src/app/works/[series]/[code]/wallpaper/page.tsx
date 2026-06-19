import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import {
  WALLPAPER_ROLE_LABELS,
  getPublishedWallpaperPack,
} from "@/lib/wallpaper";
import { getWorkBySeriesAndCode } from "@/lib/works";

const IMAGINE_PLANS_BASE_URL = "https://app.whatif-ep.xyz/plans";

interface WallpaperPageProps {
  params: Promise<{ series: string; code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function resolveVariantNumber(
  searchParams: Record<string, string | string[] | undefined>
): number {
  const raw = searchParams.variant;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: WallpaperPageProps): Promise<Metadata> {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ series, code }] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);

  const work = await getWorkBySeriesAndCode(series, code);
  if (!work) return { title: "Not Found" };

  return {
    title: `${work.seriesName} ${work.displayCode} Wallpaper`,
    description: `${work.title} wallpaper pack`,
  };
}

export default async function WallpaperPage({
  params,
  searchParams,
}: WallpaperPageProps) {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ series, code }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);

  const variantNumber = resolveVariantNumber(resolvedSearchParams);

  const [work, pack] = await Promise.all([
    getWorkBySeriesAndCode(series, code),
    getPublishedWallpaperPack(series, code, variantNumber),
  ]);

  if (!work || !pack) notFound();

  const access = await getClubAccess();
  const isPremium = canAccessClub(access);

  const variantQuery = variantNumber > 1 ? `?variant=${variantNumber}` : "";
  const downloadUrl = `/api/works/${series}/${code}/wallpaper/download?variant=${variantNumber}`;
  const galleryOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://whatif-ep.xyz";
  const returnTo = `${galleryOrigin}/works/${series}/${code}/wallpaper${variantQuery}`;
  const imaginePlansUrl = `${IMAGINE_PLANS_BASE_URL}?source=gallery&return_to=${encodeURIComponent(returnTo)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <Link
          href={`/works/${series}/${code}${variantQuery}`}
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          ← Back to work
        </Link>

        <div className="mt-6">
          <p className="font-mono text-lg text-muted">
            #{work.displayCode} Wallpaper Pack
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{work.title}</h1>
        </div>

        {pack.cover && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pack.cover.publicUrl}
              alt={`${work.title} cover`}
              className="mx-auto w-full max-w-md object-contain"
            />
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {pack.wallpapers.map((output) => (
            <div
              key={output.id}
              className="overflow-hidden rounded-xl border border-border bg-surface/30"
            >
              <div className="flex items-center justify-center bg-background/40 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={output.publicUrl}
                  alt={WALLPAPER_ROLE_LABELS[output.role]}
                  className="max-h-64 w-auto object-contain"
                />
              </div>
              <div className="border-t border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {WALLPAPER_ROLE_LABELS[output.role]}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          {isPremium ? (
            <a
              href={downloadUrl}
              className="btn-press inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Download Pack (.zip)
            </a>
          ) : (
            <Link
              href={imaginePlansUrl}
              className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              View Premium Plans in Imagine
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
