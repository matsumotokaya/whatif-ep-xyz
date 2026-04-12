"use client";

import { useState } from "react";
import Image from "next/image";

const BANNER_DISMISS_KEY = "whatif_imagine_banner_dismissed_v1";

export function ImagineBanner() {
  const [visible, setVisible] = useState(
    () => window.localStorage.getItem(BANNER_DISMISS_KEY) !== "1"
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[360px]">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <a
          href="https://app.whatif-ep.xyz/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Imagine"
          className="block"
        >
          <Image
            src="/img/banner_imagine_001.png"
            alt="Try /IMAGINE - Free design service by WHATIF"
            width={1200}
            height={360}
            className="h-auto w-full"
            priority
          />
        </a>

        <button
          type="button"
          aria-label="Close Imagine banner"
          onClick={() => {
            setVisible(false);
            window.localStorage.setItem(BANNER_DISMISS_KEY, "1");
          }}
          className="btn-press absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-background"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
