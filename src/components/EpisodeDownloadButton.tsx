"use client";

import { useState } from "react";
import { useLanguage, type Language } from "@/context/LanguageContext";

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

const DOWNLOAD_COPY: Record<
  Language,
  { downloading: string; iosGuide: string; inAppGuide: string }
> = {
  en: {
    downloading: "Downloading...",
    iosGuide:
      'On iPhone, choose "Save Image" from the share menu to save it to your camera roll.',
    inAppGuide:
      "If saving fails in the in-app browser, open the page in Safari and try again.",
  },
  ja: {
    downloading: "ダウンロード中...",
    iosGuide:
      "iPhoneでは共有メニューから「画像を保存」を選ぶとカメラロールに保存できます。",
    inAppGuide:
      "アプリ内ブラウザで保存できない場合は、Safariで開いて再度お試しください。",
  },
  "zh-CN": {
    downloading: "下载中...",
    iosGuide: "在 iPhone 上，从分享菜单选择「存储图像」即可保存到相册。",
    inAppGuide: "如果在内置浏览器中无法保存，请在 Safari 中打开后重试。",
  },
  "zh-TW": {
    downloading: "下載中...",
    iosGuide: "在 iPhone 上，從分享選單選擇「儲存影像」即可保存到相簿。",
    inAppGuide: "如果在內建瀏覽器中無法儲存，請在 Safari 中開啟後重試。",
  },
  ko: {
    downloading: "다운로드 중...",
    iosGuide:
      "iPhone에서는 공유 메뉴에서 「이미지 저장」을 선택하면 카메라 롤에 저장할 수 있습니다.",
    inAppGuide:
      "인앱 브라우저에서 저장이 안 되는 경우, Safari에서 열어 다시 시도해 주세요.",
  },
};

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

function showGuide(
  result: DownloadResult,
  copy: { iosGuide: string; inAppGuide: string }
) {
  if (result.isIOS && result.method !== "share-files") {
    window.alert(copy.iosGuide);
  }
  if (result.inAppBrowser) {
    window.alert(copy.inAppGuide);
  }
}

export function EpisodeDownloadButton({
  url,
  filename,
  className,
  children,
}: EpisodeDownloadButtonProps) {
  const { lang } = useLanguage();
  const copy = DOWNLOAD_COPY[lang];
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
          showGuide({ method: "share-files", inAppBrowser, isIOS }, copy);
          return;
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const blobDownloadTriggered = triggerDownload(blobUrl, safeFilename);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

      if (blobDownloadTriggered) {
        showGuide({ method: "blob-download", inAppBrowser, isIOS }, copy);
        return;
      }

      if (!preferShareFirst && (isAndroid || inAppBrowser || !isDesktopLike)) {
        const shared = await tryShareFile();
        if (shared) {
          showGuide({ method: "share-files", inAppBrowser, isIOS }, copy);
          return;
        }
      }

      const directFallbackTriggered = triggerDownload(url, safeFilename);
      if (directFallbackTriggered) {
        showGuide({ method: "direct-download-fallback", inAppBrowser, isIOS }, copy);
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
        {isLoading ? copy.downloading : children}
      </span>
    </button>
  );
}
