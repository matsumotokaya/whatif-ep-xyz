"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import type { WallpaperOutput } from "@/lib/wallpaper";
import BuyWallpaperButton from "./BuyWallpaperButton";
import WallpaperDownloadButton from "./WallpaperDownloadButton";
import { WALLPAPER_COPY, type WallpaperCopy } from "./copy";

// Minimal pack shape needed by the presentation layer (kept serializable so it
// can be passed from the server page as props).
interface WallpaperPackProps {
  cover: WallpaperOutput | null;
  wallpapers: WallpaperOutput[];
}

interface WallpaperPageContentProps {
  pack: WallpaperPackProps;
  workTitle: string;
  workDisplayCode: string;
  series: string;
  code: string;
  variantNumber: number;
  entitled: boolean;
  hasPurchased: boolean;
  isPremium: boolean;
  isLoggedIn: boolean;
  // True when access comes from a guest download token (emailed link /
  // post-checkout redirect) rather than a signed-in purchase.
  tokenEntitled: boolean;
  justPurchased: boolean;
  downloadUrl: string;
  imaginePlansUrl: string;
  loginUrl: string;
  variantQuery: string;
}

interface SizeGroup {
  key: "mobile" | "desktop";
  label: string;
  preview: WallpaperOutput | null;
  aspect: string;
  frameClass: string;
  specs: { tier: string; resolution: string }[];
}

function buildSizeGroups(
  wallpapers: WallpaperOutput[],
  copy: WallpaperCopy
): SizeGroup[] {
  const byRole = new Map(wallpapers.map((output) => [output.role, output]));
  return [
    {
      key: "mobile",
      label: copy.spec.mobile,
      preview: byRole.get("mobile_hd") ?? byRole.get("mobile_qhd") ?? null,
      aspect: "9 / 16",
      // Portrait frame: keep it narrow so the tall ratio reads instantly.
      frameClass: "mx-auto w-[150px] sm:w-[170px]",
      specs: [
        { tier: "FULL HD", resolution: "1080 × 1920" },
        { tier: "QHD / 2K", resolution: "1440 × 2560" },
      ],
    },
    {
      key: "desktop",
      label: copy.spec.desktop,
      preview: byRole.get("pc_hd") ?? byRole.get("pc_qhd") ?? null,
      aspect: "16 / 9",
      frameClass: "w-full max-w-md",
      specs: [
        { tier: "FULL HD", resolution: "1920 × 1080" },
        { tier: "QHD / 2K", resolution: "2560 × 1440" },
      ],
    },
  ];
}

// Repeating diagonal watermark drawn over preview images so the source art is
// not redistributable straight from the sales page.
function WatermarkOverlay({ sample }: { sample: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="absolute inset-[-25%] flex rotate-[-24deg] flex-col items-center justify-center gap-7 opacity-[0.16]">
        {Array.from({ length: 9 }).map((_, row) => (
          <span
            key={row}
            className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.5em] text-white"
          >
            {`${sample} · WHATIF · ${sample} · WHATIF · ${sample} · WHATIF`}
          </span>
        ))}
      </div>
    </div>
  );
}

function SizePreview({ group, sample }: { group: SizeGroup; sample: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface ${group.frameClass}`}>
      <div className="relative w-full" style={{ aspectRatio: group.aspect }}>
        {group.preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={group.preview.publicUrl}
              alt={`${group.label} preview`}
              className="h-full w-full object-cover"
              draggable={false}
            />
            <WatermarkOverlay sample={sample} />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface text-[10px] uppercase tracking-[0.3em] text-muted">
            {group.label}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/90 backdrop-blur-sm">
          {sample}
        </span>
      </div>
    </div>
  );
}

function SizeCard({ group, sample }: { group: SizeGroup; sample: string }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface/30 p-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex w-full justify-center sm:w-auto sm:shrink-0">
        <SizePreview group={group} sample={sample} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{group.label}</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-muted">
          {group.key === "mobile" ? "9 : 16" : "16 : 9"}
        </p>
        <ul className="mt-4 space-y-2">
          {group.specs.map((item) => (
            <li
              key={item.tier}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                {item.tier}
              </span>
              <span className="font-mono text-[11px] text-muted">{item.resolution}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function WallpaperPageContent({
  pack,
  workTitle,
  workDisplayCode,
  series,
  code,
  variantNumber,
  entitled,
  hasPurchased,
  isPremium,
  isLoggedIn,
  tokenEntitled,
  justPurchased,
  downloadUrl,
  imaginePlansUrl,
  loginUrl,
  variantQuery,
}: WallpaperPageContentProps) {
  const { lang } = useLanguage();
  const copy = WALLPAPER_COPY[lang];
  const sizeGroups = buildSizeGroups(pack.wallpapers, copy);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-10">
        <Link
          href={`/works/${series}/${code}${variantQuery}`}
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          {copy.back}
        </Link>

        {/* Hero -------------------------------------------------------------- */}
        <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-center">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/40">
            {pack.cover ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pack.cover.publicUrl}
                  alt={`${workTitle} wallpaper cover`}
                  className="aspect-square w-full object-cover"
                  draggable={false}
                />
              </>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-muted">
                {copy.eyebrow}
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-muted">
              {copy.eyebrow} · #{workDisplayCode}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              <span className="neon-text-cyan">{copy.heroTitle}</span>
            </h1>
            <p className="mt-2 text-lg text-muted">{workTitle}</p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-foreground/80">
              {copy.heroLead(workDisplayCode)}
            </p>
            <ul className="mt-6 space-y-2.5">
              {copy.heroPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <svg
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* About ------------------------------------------------------------- */}
        <section className="mt-12 rounded-2xl border border-border bg-surface/30 p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-muted">
            {copy.about.eyebrow}
          </p>
          <p className="mt-3 text-base font-medium text-foreground">
            {copy.about.lead}
          </p>
          <div className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-foreground/80">
            {copy.about.paragraphs.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
          <p className="mt-6 border-t border-border/60 pt-4 text-sm leading-relaxed text-foreground/70">
            {copy.about.stat}
          </p>
        </section>

        {/* Lineup ------------------------------------------------------------ */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-bold sm:text-2xl">{copy.lineupTitle}</h2>
            <span className="font-mono text-xs text-muted">
              {pack.wallpapers.length} {copy.included}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{copy.lineupNote}</p>

          <div className="mt-6 grid gap-5">
            {sizeGroups.map((group) => (
              <SizeCard key={group.key} group={group} sample={copy.sample} />
            ))}
          </div>
        </section>

        {/* Download / Purchase ----------------------------------------------- */}
        <section className="mt-12">
          {entitled ? (
            <div className="rounded-2xl border border-border bg-surface/30 p-6 text-center sm:p-8">
              {justPurchased ? (
                <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground">
                  {copy.purchaseThanks}
                </p>
              ) : null}
              {hasPurchased && !isPremium ? (
                <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {copy.purchasedBadge}
                </span>
              ) : null}
              <WallpaperDownloadButton
                downloadUrl={downloadUrl}
                fallbackFilename={`whatif-${code}-${variantNumber}-pack.zip`}
                idleNote={
                  hasPurchased && !isPremium
                    ? copy.purchasedNote
                    : copy.downloadReadyNote
                }
                copy={copy}
              />
              {tokenEntitled ? (
                <p className="mt-3 text-xs text-muted">
                  {copy.guestDownloadNote}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Plan A — buy this single wallpaper for $1 */}
                <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {copy.oneTimeEyebrow}
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {copy.oneTimePrice}
                    </span>
                    <span className="text-sm text-muted">
                      {copy.oneTimePriceUnit}
                    </span>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">
                    {copy.oneTimeDesc}
                  </p>
                  <div className="mt-5">
                    <BuyWallpaperButton
                      series={series}
                      code={code}
                      variant={variantNumber}
                    />
                    {!isLoggedIn ? (
                      <p className="mt-2 text-xs text-muted">
                        {copy.guestCheckoutNote}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Plan B — subscription unlocks every wallpaper */}
                <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {copy.subEyebrow}
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {copy.subPrice}
                    </span>
                    <span className="text-sm text-muted">{copy.subPriceUnit}</span>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">
                    {copy.subDesc}
                  </p>
                  <div className="mt-5">
                    <Link
                      href={imaginePlansUrl}
                      className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
                    >
                      {copy.premiumCta}
                    </Link>
                  </div>
                </div>
              </div>

              <p className="mt-5 text-center text-xs text-muted">
                {copy.alreadyMember}{" "}
                <Link
                  href={loginUrl}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {copy.login}
                </Link>
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
