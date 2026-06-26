"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { useResolvedFlag } from "@/hooks/useResolvedFlag";
import { DownloadButton } from "./DownloadButton";

// Localized labels for the work detail aside CTA cluster.
const COPY: Record<
  Language,
  {
    edit: string;
    editIllustration: string;
    editIllustrationPending: string;
    download: string;
    storeItem: string;
    wallpaperPromoTitle: string;
    wallpaperDownload: string;
    purchased: string;
    mobile: string;
    desktop: string;
    mobileSpec: string;
    desktopSpec: string;
  }
> = {
  en: {
    edit: "Edit",
    editIllustration: "Edit illustration",
    editIllustrationPending: "Edit illustration: coming soon",
    download: "Download",
    storeItem: "Store Item",
    wallpaperPromoTitle: "Download the non-credit wallpaper here",
    wallpaperDownload: "Wallpaper download",
    purchased: "Purchased",
    mobile: "Mobile",
    desktop: "Desktop",
    mobileSpec: "FULL HD · QHD (1080–1440px wide)",
    desktopSpec: "FULL HD · QHD (1920–2560px wide)",
  },
  ja: {
    edit: "編集",
    editIllustration: "イラストを編集",
    editIllustrationPending: "イラストを編集: 準備中",
    download: "ダウンロード",
    storeItem: "ストアアイテム",
    wallpaperPromoTitle: "ノンクレジット版壁紙ダウンロードはこちらから",
    wallpaperDownload: "壁紙ダウンロード",
    purchased: "購入済み",
    mobile: "Mobile",
    desktop: "Desktop",
    mobileSpec: "FULL HD · QHD（1080–1440px幅）",
    desktopSpec: "FULL HD · QHD（1920–2560px幅）",
  },
  "zh-CN": {
    edit: "编辑",
    editIllustration: "编辑插画",
    editIllustrationPending: "编辑插画：准备中",
    download: "下载",
    storeItem: "商店商品",
    wallpaperPromoTitle: "无署名版壁纸下载请点这里",
    wallpaperDownload: "壁纸下载",
    purchased: "已购买",
    mobile: "Mobile",
    desktop: "Desktop",
    mobileSpec: "FULL HD · QHD（1080–1440px 宽）",
    desktopSpec: "FULL HD · QHD（1920–2560px 宽）",
  },
  "zh-TW": {
    edit: "編輯",
    editIllustration: "編輯插畫",
    editIllustrationPending: "編輯插畫：準備中",
    download: "下載",
    storeItem: "商店商品",
    wallpaperPromoTitle: "無署名版桌布下載請點這裡",
    wallpaperDownload: "桌布下載",
    purchased: "已購買",
    mobile: "Mobile",
    desktop: "Desktop",
    mobileSpec: "FULL HD · QHD（1080–1440px 寬）",
    desktopSpec: "FULL HD · QHD（1920–2560px 寬）",
  },
  ko: {
    edit: "편집",
    editIllustration: "일러스트 편집",
    editIllustrationPending: "일러스트 편집: 준비 중",
    download: "다운로드",
    storeItem: "스토어 아이템",
    wallpaperPromoTitle: "논크레딧 배경화면 다운로드는 여기서",
    wallpaperDownload: "배경화면 다운로드",
    purchased: "구매 완료",
    mobile: "Mobile",
    desktop: "Desktop",
    mobileSpec: "FULL HD · QHD (1080–1440px 너비)",
    desktopSpec: "FULL HD · QHD (1920–2560px 너비)",
  },
};

// AI sparkles icon (filled), used on the primary "Edit illustration" button.
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.6 4.8L18.4 8.4 13.6 10 12 14.8 10.4 10 5.6 8.4 10.4 6.8z" />
      <path d="M18.5 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
      <path d="M5 14l.7 2 2 .7-2 .7L5 19.4l-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

// Download icon (down arrow into a tray).
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      />
    </svg>
  );
}

interface WorkDetailActionsProps {
  /** Streamed user flag — admin edit button appears once it resolves true. */
  isAdminPromise: Promise<boolean>;
  editHref: string | null;
  imagineUrl: string | null;
  downloadUrl: string;
  downloadFilename: string;
  storeUrl: string | null;
  wallpaperHref: string;
  wallpaperCoverUrl: string | null;
  /** Streamed user flag — purchased badge appears once it resolves true. */
  wallpaperPurchasedPromise?: Promise<boolean>;
  workTitle: string;
}

const FALSE_PROMISE = Promise.resolve(false);

export function WorkDetailActions({
  isAdminPromise,
  editHref,
  imagineUrl,
  downloadUrl,
  downloadFilename,
  storeUrl,
  wallpaperHref,
  wallpaperCoverUrl,
  wallpaperPurchasedPromise,
  workTitle,
}: WorkDetailActionsProps) {
  const { profile } = useAuth();
  const { lang } = useLanguage();
  const t = COPY[lang];
  const isAdmin =
    useResolvedFlag(isAdminPromise) || profile?.role === "admin";
  const wallpaperPurchased = useResolvedFlag(
    wallpaperPurchasedPromise ?? FALSE_PROMISE
  );

  return (
    <>
      <div className="mt-5 flex flex-col gap-2">
        {isAdmin && editHref && (
          <Link
            href={editHref}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t.edit}
          </Link>
        )}

        {imagineUrl ? (
          <a
            href={imagineUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.editIllustration}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-600"
          >
            <SparklesIcon className="h-4 w-4" />
            {t.editIllustration}
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted">
            <SparklesIcon className="h-4 w-4" />
            {t.editIllustrationPending}
          </span>
        )}

        <DownloadButton
          url={downloadUrl}
          filename={downloadFilename}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          <DownloadIcon className="h-4 w-4" />
          {t.download}
        </DownloadButton>

        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t.storeItem}
          </a>
        )}
      </div>

      {wallpaperCoverUrl && (
        <div className="mt-5 border-t border-border pt-5">
          {wallpaperPurchased && (
            <span className="mb-3 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t.purchased}
            </span>
          )}
          <p className="text-xs font-medium text-foreground">
            {t.wallpaperPromoTitle}
          </p>
          <Link
            href={wallpaperHref}
            className="mt-3 flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <span className="block shrink-0 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wallpaperCoverUrl}
                alt={`${workTitle} wallpaper`}
                className="h-20 w-20 object-cover"
              />
            </span>
            <dl className="min-w-0 flex-1 space-y-1.5">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">{t.mobile}</dt>
                <dd className="text-[11px] text-muted">{t.mobileSpec}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">{t.desktop}</dt>
                <dd className="text-[11px] text-muted">{t.desktopSpec}</dd>
              </div>
            </dl>
          </Link>
          <Link
            href={wallpaperHref}
            aria-label={t.wallpaperDownload}
            className="btn-press mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <DownloadIcon className="h-4 w-4" />
            {t.wallpaperDownload}
          </Link>
        </div>
      )}
    </>
  );
}
