"use client";

import { useState } from "react";

type DownloadMethod = "share-files" | "blob-download" | "direct-download-fallback";

interface DownloadResult {
  method: DownloadMethod;
  inAppBrowser: boolean;
  isIOS: boolean;
}

interface EpisodeDownloadButtonProps {
  url: string;
  filename: string;
  className?: string;
  children: React.ReactNode;
}

const IN_APP_BROWSER_PATTERN = /(Instagram|FBAN|FBAV|Line|MicroMessenger|wv)/i;

const IOS_SAVE_GUIDE_MESSAGE =
  "iPhoneでは共有メニューから「画像を保存」を選ぶとカメラロールに保存できます。";
const IN_APP_BROWSER_GUIDE_MESSAGE =
  "アプリ内ブラウザで保存できない場合は、Safariで開いて再度お試しください。";

function isIOSDevice() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
}

function isAndroidDevice() {
  return /Android/i.test(window.navigator.userAgent);
}

function isDesktopLikeDevice() {
  const ua = window.navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  const hasCoarsePointer =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  return !mobileUa && !hasCoarsePointer;
}

function isInAppBrowser() {
  return IN_APP_BROWSER_PATTERN.test(window.navigator.userAgent);
}

function sanitizeFilename(filename: string) {
  const cleaned = filename.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned.length > 0 ? cleaned : "whatif.png";
}

function triggerDownload(href: string, filename: string) {
  try {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}

function showGuide(result: DownloadResult) {
  if (result.isIOS && result.method !== "share-files") {
    window.alert(IOS_SAVE_GUIDE_MESSAGE);
  }
  if (result.inAppBrowser) {
    window.alert(IN_APP_BROWSER_GUIDE_MESSAGE);
  }
}

export function EpisodeDownloadButton({
  url,
  filename,
  className,
  children,
}: EpisodeDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const safeFilename = sanitizeFilename(filename);

    try {
      const inAppBrowser = isInAppBrowser();
      const isIOS = isIOSDevice();
      const isAndroid = isAndroidDevice();
      const isDesktopLike = isDesktopLikeDevice();
      const preferShareFirst = isIOS || (inAppBrowser && !isDesktopLike);

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch file");

      const blob = await response.blob();
      const file = new File([blob], safeFilename, { type: blob.type || "image/png" });

      const shareNavigator = window.navigator as Navigator & {
        share?: (data?: ShareData) => Promise<void>;
        canShare?: (data?: ShareData) => boolean;
      };

      const canShareFile =
        typeof shareNavigator.share === "function" &&
        (typeof shareNavigator.canShare !== "function" ||
          shareNavigator.canShare({ files: [file] }));

      const tryShareFile = async () => {
        if (!canShareFile || typeof shareNavigator.share !== "function") {
          return false;
        }

        try {
          await shareNavigator.share({
            files: [file],
            title: safeFilename,
          });
          return true;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            throw error;
          }
          return false;
        }
      };

      if (preferShareFirst) {
        const shared = await tryShareFile();
        if (shared) {
          showGuide({ method: "share-files", inAppBrowser, isIOS });
          return;
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const blobDownloadTriggered = triggerDownload(blobUrl, safeFilename);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

      if (blobDownloadTriggered) {
        showGuide({ method: "blob-download", inAppBrowser, isIOS });
        return;
      }

      if (!preferShareFirst && (isAndroid || inAppBrowser || !isDesktopLike)) {
        const shared = await tryShareFile();
        if (shared) {
          showGuide({ method: "share-files", inAppBrowser, isIOS });
          return;
        }
      }

      const directFallbackTriggered = triggerDownload(url, safeFilename);
      if (directFallbackTriggered) {
        showGuide({ method: "direct-download-fallback", inAppBrowser, isIOS });
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const directFallbackTriggered = triggerDownload(url, safeFilename);
      if (!directFallbackTriggered) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isLoading}
      className={`btn-press relative overflow-hidden ${className ?? ""}`}
    >
      {isLoading && (
        <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-full bg-border">
          <span className="absolute inset-0 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />
        </span>
      )}
      <span className={`inline-flex items-center gap-2 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
        {isLoading ? "Downloading..." : children}
      </span>
    </button>
  );
}
