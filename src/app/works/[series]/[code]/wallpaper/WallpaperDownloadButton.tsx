"use client";

import { useCallback, useRef, useState } from "react";
import type { WallpaperCopy } from "./copy";

type Status = "idle" | "preparing" | "downloading" | "done" | "error";

interface WallpaperDownloadButtonProps {
  // API route that streams the generated zip. Same-origin so cookies are sent.
  downloadUrl: string;
  // Fallback name if the server omits a Content-Disposition header.
  fallbackFilename: string;
  // Note shown under the button while idle (varies for purchased vs premium).
  idleNote: string;
  copy: WallpaperCopy;
}

// Parse `filename*=UTF-8''...` or `filename="..."` from a Content-Disposition header.
function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // fall through to the plain filename
    }
  }
  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  return plainMatch ? plainMatch[1].trim() : null;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export default function WallpaperDownloadButton({
  downloadUrl,
  fallbackFilename,
  idleNote,
  copy,
}: WallpaperDownloadButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [percent, setPercent] = useState(0);
  const resetTimer = useRef<number | null>(null);

  const busy = status === "preparing" || status === "downloading";

  const handleDownload = useCallback(async () => {
    if (busy) return;
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    setPercent(0);
    setStatus("preparing");

    try {
      // Phase 1: server generates the zip — no bytes arrive until this resolves.
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Request failed");

      const contentType = response.headers.get("content-type") ?? "";
      // A login/entitlement redirect returns HTML, not a zip — treat as error.
      if (!contentType.includes("zip") && !contentType.includes("octet-stream")) {
        throw new Error("Unexpected response");
      }

      const filename =
        parseFilename(response.headers.get("content-disposition")) ??
        fallbackFilename;

      // Phase 2: stream the bytes so we can show real download progress.
      const totalHeader = response.headers.get("content-length");
      const total = totalHeader ? Number.parseInt(totalHeader, 10) : 0;

      let blob: Blob;
      if (response.body && total > 0) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        setStatus("downloading");
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            setPercent(Math.min(100, Math.round((received / total) * 100)));
          }
        }
        blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      } else {
        blob = await response.blob();
      }

      triggerBlobDownload(blob, filename);
      setStatus("done");
      resetTimer.current = window.setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
    }
  }, [busy, downloadUrl, fallbackFilename]);

  const label =
    status === "preparing"
      ? copy.downloadPreparing
      : status === "downloading"
        ? copy.downloadProgress(percent)
        : status === "done"
          ? copy.downloadStarted
          : copy.downloadReady;

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        aria-busy={busy}
        className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-8 py-4 text-base font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-80 sm:w-auto"
      >
        {busy ? (
          <svg
            className="h-5 w-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : status === "done" ? (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
        )}
        {label}
      </button>

      {/* Progress track: indeterminate while generating, determinate while downloading. */}
      {busy ? (
        <div
          className="mx-auto mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status === "downloading" ? percent : undefined}
        >
          {status === "downloading" ? (
            <span
              className="block h-full rounded-full bg-foreground transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <span className="block h-full w-full animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground to-transparent" />
          )}
        </div>
      ) : null}

      <p
        className="mt-3 text-xs text-muted"
        aria-live="polite"
        role="status"
      >
        {status === "error"
          ? copy.downloadError
          : busy
            ? copy.downloadPreparingNote
            : idleNote}
      </p>
    </div>
  );
}
