"use client";

import { useState } from "react";

interface BuyWallpaperButtonProps {
  series: string;
  code: string;
  variant: number;
  loginUrl: string;
}

// Japanese UI copy.
const LABEL = "$1 で購入する";
const LABEL_PENDING = "処理中…";
const ERROR_TEXT = "購入を開始できませんでした。時間をおいてお試しください。";

export default function BuyWallpaperButton({
  series,
  code,
  variant,
  loginUrl,
}: BuyWallpaperButtonProps) {
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
        {pending ? LABEL_PENDING : LABEL}
      </button>
      {error ? <p className="text-xs text-red-600">{ERROR_TEXT}</p> : null}
    </div>
  );
}
