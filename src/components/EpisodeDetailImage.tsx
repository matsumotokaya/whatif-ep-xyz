"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage, type Language } from "@/context/LanguageContext";

interface EpisodeDetailImageProps {
  candidates: string[];
  alt: string;
  // When present, the artwork itself becomes a shortcut into the IMAGINE editor
  // (same destination as the violet "Edit illustration" button). Drives traffic.
  imagineUrl?: string | null;
}

const COPY: Record<
  Language,
  { edit: string; confirmTitle: string; confirmCta: string; cancel: string }
> = {
  en: {
    edit: "Edit illustration",
    confirmTitle: "Edit this illustration in IMAGINE?",
    confirmCta: "Edit in IMAGINE",
    cancel: "Cancel",
  },
  ja: {
    edit: "イラストを編集",
    confirmTitle: "このイラストを IMAGINE で編集しますか？",
    confirmCta: "IMAGINE で編集",
    cancel: "キャンセル",
  },
  "zh-CN": {
    edit: "编辑插画",
    confirmTitle: "在 IMAGINE 中编辑这张插画？",
    confirmCta: "在 IMAGINE 中编辑",
    cancel: "取消",
  },
  "zh-TW": {
    edit: "編輯插畫",
    confirmTitle: "在 IMAGINE 中編輯這張插畫？",
    confirmCta: "在 IMAGINE 中編輯",
    cancel: "取消",
  },
  ko: {
    edit: "일러스트 편집",
    confirmTitle: "이 일러스트를 IMAGINE에서 편집할까요?",
    confirmCta: "IMAGINE에서 편집",
    cancel: "취소",
  },
};

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.6 4.8L18.4 8.4 13.6 10 12 14.8 10.4 10 5.6 8.4 10.4 6.8z" />
      <path d="M18.5 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
      <path d="M5 14l.7 2 2 .7-2 .7L5 19.4l-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

export function EpisodeDetailImage({
  candidates,
  alt,
  imagineUrl,
}: EpisodeDetailImageProps) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const upgradedRef = useRef(false);
  const src = candidates[index] ?? "";
  const editable = Boolean(imagineUrl);
  const isLoading = Boolean(src) && loadedSrc !== src;

  useEffect(() => {
    upgradedRef.current = false;
  }, [candidates]);

  const setImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (node && src && node.complete && node.naturalWidth > 0) {
        setLoadedSrc(src);
      }
    },
    [src]
  );

  const openImagine = useCallback(() => {
    if (imagineUrl) window.open(imagineUrl, "_blank", "noopener,noreferrer");
  }, [imagineUrl]);

  const handleActivate = useCallback(() => {
    if (!imagineUrl) return;
    // Touch devices: confirm first so a stray tap doesn't yank the user away.
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      setConfirmOpen(true);
    } else {
      openImagine();
    }
  }, [imagineUrl, openImagine]);

  return (
    <div className="relative h-full w-full">
      {isLoading && src && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="shimmer h-full w-full" />
        </div>
      )}
      <Image
        key={src}
        ref={setImageRef}
        src={src}
        alt={alt}
        fill
        // Served directly from R2 (egress-free) instead of through Vercel Image
        // Optimization. The feed PNG is already a sensible size, and this avoids
        // the /_next/image transformation quota (which returns 402 once exhausted).
        unoptimized
        sizes="(min-width: 1024px) calc(100vw - 360px), 100vw"
        className={`object-contain object-top p-2 transition-opacity duration-500 ease-out sm:p-4 lg:p-8 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        priority
        onError={() => {
          setIndex((current) => current + 1);
        }}
        onLoad={() => {
          setLoadedSrc(src);

          // Paint a lightweight preview first, then upgrade once the heavier
          // source finishes in the background. This keeps detail navigation
          // responsive without permanently locking the page to the preview.
          if (index !== 0 || candidates.length < 2 || upgradedRef.current) {
            return;
          }

          const nextSrc = candidates[1];
          if (!nextSrc || nextSrc === src) {
            return;
          }

          upgradedRef.current = true;
          const preload = new window.Image();
          preload.onload = () => {
            setIndex(1);
          };
          preload.onerror = () => {
            upgradedRef.current = false;
          };
          preload.src = nextSrc;
        }}
      />

      {editable && (
        <button
          type="button"
          onClick={handleActivate}
          aria-label={t.edit}
          className="group absolute inset-0 z-[1] cursor-pointer focus:outline-none"
        >
          {/* Hover veil + centered prompt (pointer/desktop). */}
          <span className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/25" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <SparklesIcon className="h-4 w-4" />
            {t.edit}
          </span>
          {/* Always-on affordance hint (bottom-left) so it reads as clickable
              on touch too, where hover never fires. */}
          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-0 sm:bottom-4 sm:left-4">
            <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
            {t.edit}
          </span>
        </button>
      )}

      {confirmOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="menu-overlay-enter fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmOpen(false)}
          >
            <div
              className="dropdown-enter w-full max-w-xs rounded-2xl border border-border bg-surface p-6 text-center shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
                <SparklesIcon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {t.confirmTitle}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false);
                    openImagine();
                  }}
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {t.confirmCta}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="btn-press inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
