"use client";

import { useEffect, useState } from "react";

type IntroLocale = "en" | "ja";
const LOCALE_STORAGE_KEY = "whatif_menu_locale";
const LOCALE_EVENT_NAME = "whatif-locale-change";

const introCopy: Record<IntroLocale, string[]> = {
  en: [
    "The Club is a members-only download service.",
    "It is available only to subscribers of the WHATIF Instagram account.",
    "If you are an Instagram subscriber, please use the Instagram member entrance link below the login form.",
    "Starting in April 2026, /IMAGINE Premium members can also use The Club features.",
    "/IMAGINE Premium members can log in with the same account and enjoy unlimited downloads.",
  ],
  ja: [
    "The Club は会員制のダウンロードサービスです。",
    "WHATIF の Instagram アカウントにおけるサブスク会員のみに提供されるサービスです。",
    "サブスク会員の方は、ログインフォーム下部にある Instagram 会員専用の入り口からお入りください。",
    "2026年4月より、/IMAGINE のプレミアム会員サービス加入者も The Club の機能をご利用いただけるようになりました。",
    "/IMAGINE のプレミアム会員の方は、同じアカウントでログインいただければダウンロードし放題です。",
  ],
};

export function TheClubIntroMessage() {
  const [locale, setLocale] = useState<IntroLocale>(() => {
    if (typeof window === "undefined") return "en";
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return savedLocale === "ja" ? "ja" : "en";
  });

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY) return;
      const nextLocale = event.newValue === "ja" ? "ja" : "en";
      setLocale(nextLocale);
    };
    const onLocaleChange = (event: Event) => {
      const customEvent = event as CustomEvent<IntroLocale>;
      setLocale(customEvent.detail === "ja" ? "ja" : "en");
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCALE_EVENT_NAME, onLocaleChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOCALE_EVENT_NAME, onLocaleChange);
    };
  }, []);

  const applyLocale = (nextLocale: IntroLocale) => {
    setLocale(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(
      new CustomEvent<IntroLocale>(LOCALE_EVENT_NAME, { detail: nextLocale })
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-4 inline-flex rounded-full border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => applyLocale("en")}
          className={`btn-press rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            locale === "en"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
          aria-label="Switch The Club intro language to English"
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => applyLocale("ja")}
          className={`btn-press rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            locale === "ja"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
          aria-label="Switch The Club intro language to Japanese"
        >
          JA
        </button>
      </div>
      <div className="space-y-3">
        {introCopy[locale].map((line) => (
          <p key={line} className="text-sm leading-7 text-muted">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
