"use client";

import { useState } from "react";
import { useLanguage, type Language } from "@/context/LanguageContext";

interface BuyWallpaperButtonProps {
  series: string;
  code: string;
  variant: number;
  loginUrl: string;
}

// Localized UI copy. Brand token "$1" is kept intact across languages.
const COPY: Record<
  Language,
  { label: string; pending: string; error: string }
> = {
  en: {
    label: "Buy for $1",
    pending: "Processing…",
    error: "Could not start the purchase. Please try again later.",
  },
  ja: {
    label: "$1 で購入する",
    pending: "処理中…",
    error: "購入を開始できませんでした。時間をおいてお試しください。",
  },
  "zh-CN": {
    label: "$1 购买",
    pending: "处理中…",
    error: "无法开始购买，请稍后再试。",
  },
  "zh-TW": {
    label: "$1 購買",
    pending: "處理中…",
    error: "無法開始購買，請稍後再試。",
  },
  ko: {
    label: "$1에 구매하기",
    pending: "처리 중…",
    error: "구매를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  },
};

export default function BuyWallpaperButton({
  series,
  code,
  variant,
  loginUrl,
}: BuyWallpaperButtonProps) {
  const { lang } = useLanguage();
  const labels = COPY[lang];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(false);

    try {
      const response = await fetch(
        `/api/works/${series}/${code}/wallpaper/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant }),
        }
      );

      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        alreadyEntitled?: boolean;
        downloadUrl?: string;
        error?: string;
        loginUrl?: string;
      };

      if (response.status === 401 && data.error === "auth_required") {
        window.location.href = data.loginUrl ?? loginUrl;
        return;
      }

      if (data.alreadyEntitled && data.downloadUrl) {
        window.location.href = data.downloadUrl;
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError(true);
      setPending(false);
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? labels.pending : labels.label}
      </button>
      {error ? <p className="text-xs text-red-600">{labels.error}</p> : null}
    </div>
  );
}
