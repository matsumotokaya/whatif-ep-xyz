import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import {
  type WallpaperOutput,
  type WallpaperPack,
  getPublishedWallpaperPack,
} from "@/lib/wallpaper";
import { getWorkBySeriesAndCode } from "@/lib/works";

const IMAGINE_PLANS_BASE_URL = "https://app.whatif-ep.xyz/plans";
const PREMIUM_PRICE_LABEL = "$3 / month";

// ---------------------------------------------------------------------------
// Copy (Japanese first; extract to i18n later)
// ---------------------------------------------------------------------------
const copy = {
  back: "← 作品にもどる",
  eyebrow: "WALLPAPER PACK",
  heroTitle: "スマホ & PC ウォールペーパー",
  heroLead: (code: string) =>
    `EPISODE ${code} のノンクレジット・フルサイズ壁紙パック。スマートフォンとデスクトップ、それぞれに FULL HD と QHD の高解像度を収録しています。`,
  heroPoints: [
    "ロゴ・クレジットなしのクリーンな仕上がり",
    "スマホ縦型 & PC 横型、合計4サイズ",
    "FULL HD 〜 QHD の高解像度",
  ],
  lineupTitle: "収録サイズ",
  lineupNote: "プレビューはサンプルです。実際の配布データに透かしは入りません。",
  sample: "SAMPLE",
  included: "収録",
  premiumPitchTitle: "すべての壁紙を、ダウンロードし放題。",
  premiumPitchBody: [
    `IMAGINE プレミアムなら、月額 ${PREMIUM_PRICE_LABEL} で WHATIF のすべての壁紙にアクセスし放題。`,
    "さらにデザインツール IMAGINE の WHATIF デザインテンプレートもすべてアンロック。あなたの作品づくりがそのまま始められます。",
  ],
  premiumCta: "IMAGINE プレミアムに登録する →",
  premiumPrice: PREMIUM_PRICE_LABEL,
  alreadyMember: "すでにプレミアム会員ですか？",
  login: "ログイン",
  downloadReady: "壁紙パックをダウンロード（.zip）",
  downloadReadyNote: "4サイズすべてを1つの zip にまとめてお届けします。",
  downloadLocked: "ダウンロードはプレミアム限定",
  downloadLockedNote: "下のプランに登録すると、このパックをすぐにダウンロードできます。",
  spec: {
    mobile: "スマートフォン（縦型）",
    desktop: "デスクトップ（横型）",
  },
} as const;

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

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

// Repeating diagonal watermark drawn over preview images so the source art is
// not redistributable straight from the sales page.
function WatermarkOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="absolute inset-[-25%] flex rotate-[-24deg] flex-col items-center justify-center gap-7 opacity-[0.16]">
        {Array.from({ length: 9 }).map((_, row) => (
          <span
            key={row}
            className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.5em] text-white"
          >
            {`${copy.sample} · WHATIF · ${copy.sample} · WHATIF · ${copy.sample} · WHATIF`}
          </span>
        ))}
      </div>
    </div>
  );
}

interface SizeGroup {
  key: "mobile" | "desktop";
  label: string;
  preview: WallpaperOutput | null;
  aspect: string;
  frameClass: string;
  specs: { tier: string; resolution: string }[];
}

function buildSizeGroups(pack: WallpaperPack): SizeGroup[] {
  const byRole = new Map(pack.wallpapers.map((output) => [output.role, output]));
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

function SizePreview({ group }: { group: SizeGroup }) {
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
            <WatermarkOverlay />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface text-[10px] uppercase tracking-[0.3em] text-muted">
            {group.label}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/90 backdrop-blur-sm">
          {copy.sample}
        </span>
      </div>
    </div>
  );
}

function SizeCard({ group }: { group: SizeGroup }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface/30 p-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex w-full justify-center sm:w-auto sm:shrink-0">
        <SizePreview group={group} />
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
  const loginUrl = `/auth/login?next=${encodeURIComponent(`/works/${series}/${code}/wallpaper${variantQuery}`)}`;

  const sizeGroups = buildSizeGroups(pack);

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
                  alt={`${work.title} wallpaper cover`}
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
              {copy.eyebrow} · #{work.displayCode}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              <span className="neon-text-cyan">{copy.heroTitle}</span>
            </h1>
            <p className="mt-2 text-lg text-muted">{work.title}</p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-foreground/80">
              {copy.heroLead(work.displayCode)}
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
              <SizeCard key={group.key} group={group} />
            ))}
          </div>
        </section>

        {/* Download / Upsell ------------------------------------------------- */}
        <section className="mt-12">
          {isPremium ? (
            <div className="rounded-2xl border border-border bg-surface/30 p-6 text-center sm:p-8">
              <a
                href={downloadUrl}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-8 py-4 text-base font-semibold text-background transition-opacity hover:opacity-80"
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
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                  />
                </svg>
                {copy.downloadReady}
              </a>
              <p className="mt-3 text-xs text-muted">{copy.downloadReadyNote}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#00f0ff]/30 bg-gradient-to-b from-surface/60 to-surface/20">
              <div className="border-b border-border/60 p-6 text-center sm:p-8">
                <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-surface px-8 py-4 text-base font-semibold text-muted">
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  {copy.downloadLocked}
                </span>
                <p className="mt-3 text-xs text-muted">{copy.downloadLockedNote}</p>
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold sm:text-2xl">
                    <span className="neon-text-magenta">{copy.premiumPitchTitle}</span>
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {copy.premiumPitchBody.map((line) => (
                    <p key={line} className="text-sm leading-relaxed text-foreground/85">
                      {line}
                    </p>
                  ))}
                </div>

                <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={imaginePlansUrl}
                    className="btn-press inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff00e5] px-7 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
                  >
                    {copy.premiumCta}
                  </Link>
                  <p className="text-sm text-muted">
                    <span className="text-lg font-bold text-foreground">{copy.premiumPrice}</span>
                  </p>
                </div>

                <p className="mt-5 text-xs text-muted">
                  {copy.alreadyMember}{" "}
                  <Link href={loginUrl} className="text-foreground underline-offset-2 hover:underline">
                    {copy.login}
                  </Link>
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
