"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClubAccessState } from "@/lib/club/access";

type AccessLocale = "en" | "ja";

const LOCALE_STORAGE_KEY = "whatif_menu_locale";
const LOCALE_EVENT_NAME = "whatif-locale-change";
const IMAGINE_UPGRADE_URL = "https://app.whatif-ep.xyz/upgrade";

type AccessCopy = {
  sectionLabel: string;
  anonymousTitle: string;
  premiumTitle: string;
  freeTitle: string;
  anonymousDescription: string;
  premiumDescription: string;
  freeDescription: string;
  loginLabel: string;
  openLibraryLabel: string;
  upgradeLabel: string;
  galleryLabel: string;
  catalogEntriesLabel: string;
  wallpaperSetsLabel: string;
};

const copy: Record<AccessLocale, AccessCopy> = {
  en: {
    sectionLabel: "Access",
    anonymousTitle: "Sign in to continue",
    premiumTitle: "Welcome",
    freeTitle: "Premium required",
    anonymousDescription:
      "Use your existing WHATIF account to sign in and check access to The Club.",
    premiumDescription:
      "You have full access to The Club library and all member content.",
    freeDescription:
      "Your account is active, but premium membership is required to enter The Club.",
    loginLabel: "Log in",
    openLibraryLabel: "Open library",
    upgradeLabel: "Upgrade in /IMAGINE",
    galleryLabel: "Gallery",
    catalogEntriesLabel: "Catalog entries",
    wallpaperSetsLabel: "Wallpaper sets",
  },
  ja: {
    sectionLabel: "アクセス",
    anonymousTitle: "ログインして続行",
    premiumTitle: "ようこそ",
    freeTitle: "プレミアム会員が必要です",
    anonymousDescription:
      "既存の WHATIF アカウントでログインすると、The Club の利用可否を確認できます。",
    premiumDescription:
      "The Club ライブラリと会員向けコンテンツをすべて利用できます。",
    freeDescription:
      "アカウントは有効ですが、The Club の利用にはプレミアム会員登録が必要です。",
    loginLabel: "ログイン",
    openLibraryLabel: "ライブラリを開く",
    upgradeLabel: "/IMAGINE でアップグレード",
    galleryLabel: "ギャラリー",
    catalogEntriesLabel: "カタログ数",
    wallpaperSetsLabel: "壁紙セット数",
  },
};

function resolveTitle(
  locale: AccessLocale,
  status: ClubAccessState,
  premium: boolean,
  displayName: string
) {
  if (status === "anonymous") return copy[locale].anonymousTitle;
  if (premium) return `${copy[locale].premiumTitle}, ${displayName}`;
  return copy[locale].freeTitle;
}

function resolveDescription(locale: AccessLocale, status: ClubAccessState, premium: boolean) {
  if (status === "anonymous") return copy[locale].anonymousDescription;
  if (premium) return copy[locale].premiumDescription;
  return copy[locale].freeDescription;
}

export function TheClubAccessSection({
  status,
  premium,
  displayName,
  stats,
}: {
  status: ClubAccessState;
  premium: boolean;
  displayName: string;
  stats: { total: number; wallpapers: number };
}) {
  const [locale, setLocale] = useState<AccessLocale>(() => {
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
      const customEvent = event as CustomEvent<AccessLocale>;
      setLocale(customEvent.detail === "ja" ? "ja" : "en");
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCALE_EVENT_NAME, onLocaleChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOCALE_EVENT_NAME, onLocaleChange);
    };
  }, []);

  const applyLocale = (nextLocale: AccessLocale) => {
    setLocale(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(
      new CustomEvent<AccessLocale>(LOCALE_EVENT_NAME, { detail: nextLocale })
    );
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-surface p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted">
            {copy[locale].sectionLabel}
          </p>
          <div className="inline-flex rounded-full border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => applyLocale("en")}
              className={`btn-press rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                locale === "en"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
              aria-label="Switch access language to English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => applyLocale("ja")}
              className={`btn-press rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                locale === "ja"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
              aria-label="Switch access language to Japanese"
            >
              JA
            </button>
          </div>
        </div>

        <h2 className="mt-3 text-2xl font-bold text-foreground">
          {resolveTitle(locale, status, premium, displayName)}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
          {resolveDescription(locale, status, premium)}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {status === "anonymous" ? (
            <Link
              href="/auth/login?next=%2Fthe-club"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              {copy[locale].loginLabel}
            </Link>
          ) : premium ? (
            <Link
              href="/the-club/library"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              {copy[locale].openLibraryLabel}
            </Link>
          ) : (
            <a
              href={IMAGINE_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              {copy[locale].upgradeLabel}
            </a>
          )}
          <Link
            href="/episodes"
            className="btn-press inline-flex items-center rounded-lg border border-border px-8 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {copy[locale].galleryLabel}
          </Link>
        </div>
      </section>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        <div className="bg-surface px-6 py-5">
          <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
            {copy[locale].catalogEntriesLabel}
          </dt>
          <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {stats.total}
          </dd>
        </div>
        <div className="bg-surface px-6 py-5">
          <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
            {copy[locale].wallpaperSetsLabel}
          </dt>
          <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {stats.wallpapers}
          </dd>
        </div>
      </dl>
    </>
  );
}
