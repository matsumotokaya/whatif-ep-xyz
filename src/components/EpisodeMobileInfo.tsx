"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Episode } from "@/lib/types";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { EpisodeDownloadButton } from "./EpisodeDownloadButton";

// Localized labels for the episode mobile info sheet.
const INFO_COPY: Record<
  Language,
  {
    info: string;
    closePanel: string;
    status: string;
    published: string;
    draft: string;
    download: string;
    edit: string;
    buyWallpaper: string;
  }
> = {
  en: {
    info: "Info",
    closePanel: "Close info panel",
    status: "Status",
    published: "Published",
    draft: "Draft",
    download: "Download",
    edit: "Edit",
    buyWallpaper: "Buy Wallpaper",
  },
  ja: {
    info: "情報",
    closePanel: "情報パネルを閉じる",
    status: "ステータス",
    published: "公開中",
    draft: "下書き",
    download: "ダウンロード",
    edit: "編集",
    buyWallpaper: "壁紙を購入",
  },
  "zh-CN": {
    info: "信息",
    closePanel: "关闭信息面板",
    status: "状态",
    published: "已发布",
    draft: "草稿",
    download: "下载",
    edit: "编辑",
    buyWallpaper: "购买壁纸",
  },
  "zh-TW": {
    info: "資訊",
    closePanel: "關閉資訊面板",
    status: "狀態",
    published: "已發布",
    draft: "草稿",
    download: "下載",
    edit: "編輯",
    buyWallpaper: "購買桌布",
  },
  ko: {
    info: "정보",
    closePanel: "정보 패널 닫기",
    status: "상태",
    published: "공개",
    draft: "초안",
    download: "다운로드",
    edit: "편집",
    buyWallpaper: "배경화면 구매",
  },
};

interface EpisodeMobileInfoProps {
  episode: Episode;
  dates: { label: string; value: string }[];
  isAdmin: boolean;
  downloadUrl: string;
  downloadFilename: string;
}

export function EpisodeMobileInfo({
  episode,
  dates,
  isAdmin,
  downloadUrl,
  downloadFilename,
}: EpisodeMobileInfoProps) {
  const { lang } = useLanguage();
  const t = INFO_COPY[lang];
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const close = useCallback(() => {
    setDragOffsetY(0);
    setDragStartY(null);
    setIsDragging(false);
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 250);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!open || closing) return;
    setDragStartY(event.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || dragStartY === null) return;
    const offset = event.touches[0].clientY - dragStartY;
    if (offset <= 0) {
      setDragOffsetY(0);
      return;
    }
    setDragOffsetY(Math.min(offset, 180));
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const shouldClose = dragOffsetY > 80;
    setIsDragging(false);
    setDragStartY(null);
    if (shouldClose) {
      close();
      return;
    }
    setDragOffsetY(0);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {t.info}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm ${
              closing ? "animate-[menuFadeOut_200ms_ease-in_both]" : "animate-[menuFadeIn_200ms_ease-out_both]"
            }`}
            onClick={close}
          />

          {/* Bottom sheet */}
          <div
            className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-background shadow-2xl ${
              closing
                ? "animate-[sheetSlideDown_250ms_ease-in_both]"
                : "animate-[sheetSlideUp_350ms_cubic-bezier(0.16,1,0.3,1)_both]"
            }`}
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isDragging ? "none" : undefined,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-8 rounded-full bg-border" />
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 pb-8 pt-2">
              {/* Title */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted">
                      #{episode.number}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-foreground">
                      {episode.title}
                    </h2>
                    {episode.category && (
                      <p className="mt-1 text-sm text-muted">{episode.category}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="btn-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    aria-label={t.closePanel}
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
                        d="M6 6l12 12M18 6L6 18"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <dl className="grid grid-cols-2 gap-3 text-xs">
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
                    {t.status}
                  </dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${episode.isPublished ? "text-foreground" : "text-muted"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${episode.isPublished ? "bg-foreground" : "bg-muted/50"}`}
                      />
                      {episode.isPublished ? t.published : t.draft}
                    </span>
                  </dd>
                </div>
              </dl>

              {/* Actions */}
              <div className="mt-5 flex flex-col gap-2.5">
                <EpisodeDownloadButton
                  url={downloadUrl}
                  filename={downloadFilename}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  {t.download}
                </EpisodeDownloadButton>
                {isAdmin && (
                  <Link
                    href={`/episodes/${episode.number}/edit`}
                    className="btn-press inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                    onClick={close}
                  >
                    {t.edit}
                  </Link>
                )}
                {episode.productUrl && (
                  <a
                    href={episode.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    {t.buyWallpaper}
                  </a>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
