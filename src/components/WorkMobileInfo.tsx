"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Work, WorkVariant, WorkOffer } from "@/lib/types";
import { EpisodeDownloadButton } from "./EpisodeDownloadButton";

interface WorkMobileInfoProps {
  work: Work;
  variant: WorkVariant;
  dates: { label: string; value: string }[];
  isAdmin: boolean;
  downloadUrl: string;
  downloadFilename: string;
}

function resolveOffer(
  work: Work,
  variant: WorkVariant,
  offerType: WorkOffer["offerType"]
) {
  return (
    variant.offers.find((offer) => offer.offerType === offerType) ??
    work.offers.find((offer) => offer.offerType === offerType) ??
    null
  );
}

export function WorkMobileInfo({
  work,
  variant,
  dates,
  isAdmin,
  downloadUrl,
  downloadFilename,
}: WorkMobileInfoProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const wallpaperOffer = resolveOffer(work, variant, "wallpaper");
  const imagineOffer = resolveOffer(work, variant, "imagine_starter");
  const storeOffer = resolveOffer(work, variant, "store_product");

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
    document.body.style.overflow = open ? "hidden" : "";
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
    setDragOffsetY(offset > 0 ? Math.min(offset, 180) : 0);
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
        Info
      </button>

      {open && (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm ${
              closing ? "animate-[menuFadeOut_200ms_ease-in_both]" : "animate-[menuFadeIn_200ms_ease-out_both]"
            }`}
            onClick={close}
          />

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
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1 w-8 rounded-full bg-border" />
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 pb-8 pt-2">
              <div className="mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted">
                      #{work.displayCode}
                      {work.variants.length > 1 ? ` / ${variant.variantNumber}` : ""}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-foreground">{work.title}</h2>
                    {work.themeCategory && (
                      <p className="mt-1 text-sm text-muted">{work.themeCategory}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="btn-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    aria-label="Close info panel"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                {dates.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</dt>
                    <dd className="mt-1 text-foreground">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-muted">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${work.status === "published" ? "text-foreground" : "text-muted"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${work.status === "published" ? "bg-foreground" : "bg-muted/50"}`}
                      />
                      {work.status === "published" ? "Published" : "Draft"}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-col gap-2.5">
                <EpisodeDownloadButton
                  url={downloadUrl}
                  filename={downloadFilename}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  Download
                </EpisodeDownloadButton>

                {wallpaperOffer?.status === "ready" && wallpaperOffer.targetUrl ? (
                  <a
                    href={wallpaperOffer.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    Wallpaper
                  </a>
                ) : (
                  <span className="inline-flex w-full items-center justify-center rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted">
                    Wallpaper: Preparing
                  </span>
                )}

                {imagineOffer?.status === "ready" && imagineOffer.targetUrl ? (
                  <a
                    href={imagineOffer.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    Edit in IMAGINE
                  </a>
                ) : (
                  <span className="inline-flex w-full items-center justify-center rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted">
                    IMAGINE: Preparing
                  </span>
                )}

                {storeOffer?.status === "ready" && storeOffer.targetUrl && (
                  <a
                    href={storeOffer.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    Store Item
                  </a>
                )}

                {isAdmin && work.legacyEpisodeId && (
                  <Link
                    href={`/episodes/${work.displayCode}/edit`}
                    className="btn-press inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                    onClick={close}
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
