"use client";

import Link from "next/link";
import { useLanguage, type Language } from "@/context/LanguageContext";
import type { ClubAccessState } from "@/lib/club/access";

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

const copy: Record<Language, AccessCopy> = {
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
  "zh-CN": {
    sectionLabel: "访问",
    anonymousTitle: "登录以继续",
    premiumTitle: "欢迎",
    freeTitle: "需要 Premium 会员",
    anonymousDescription:
      "使用现有的 WHATIF 账号登录，即可确认 The Club 的访问权限。",
    premiumDescription: "您可完整访问 The Club 资料库及所有会员内容。",
    freeDescription:
      "您的账号已激活，但进入 The Club 需要 Premium 会员资格。",
    loginLabel: "登录",
    openLibraryLabel: "打开资料库",
    upgradeLabel: "在 /IMAGINE 升级",
    galleryLabel: "画廊",
    catalogEntriesLabel: "目录数量",
    wallpaperSetsLabel: "壁纸套装数",
  },
  "zh-TW": {
    sectionLabel: "存取",
    anonymousTitle: "登入以繼續",
    premiumTitle: "歡迎",
    freeTitle: "需要 Premium 會員",
    anonymousDescription:
      "使用現有的 WHATIF 帳號登入，即可確認 The Club 的存取權限。",
    premiumDescription: "您可完整存取 The Club 資料庫及所有會員內容。",
    freeDescription:
      "您的帳號已啟用，但進入 The Club 需要 Premium 會員資格。",
    loginLabel: "登入",
    openLibraryLabel: "開啟資料庫",
    upgradeLabel: "在 /IMAGINE 升級",
    galleryLabel: "藝廊",
    catalogEntriesLabel: "目錄數量",
    wallpaperSetsLabel: "桌布套組數",
  },
  ko: {
    sectionLabel: "접근",
    anonymousTitle: "로그인하여 계속하기",
    premiumTitle: "환영합니다",
    freeTitle: "Premium 회원이 필요합니다",
    anonymousDescription:
      "기존 WHATIF 계정으로 로그인하면 The Club 이용 가능 여부를 확인할 수 있습니다.",
    premiumDescription:
      "The Club 라이브러리와 모든 회원 콘텐츠를 전부 이용하실 수 있습니다.",
    freeDescription:
      "계정은 활성화되어 있으나, The Club 이용에는 Premium 회원 가입이 필요합니다.",
    loginLabel: "로그인",
    openLibraryLabel: "라이브러리 열기",
    upgradeLabel: "/IMAGINE에서 업그레이드",
    galleryLabel: "갤러리",
    catalogEntriesLabel: "카탈로그 수",
    wallpaperSetsLabel: "배경화면 세트 수",
  },
};

function resolveTitle(
  locale: Language,
  status: ClubAccessState,
  premium: boolean,
  displayName: string
) {
  if (status === "anonymous") return copy[locale].anonymousTitle;
  if (premium) return `${copy[locale].premiumTitle}, ${displayName}`;
  return copy[locale].freeTitle;
}

function resolveDescription(locale: Language, status: ClubAccessState, premium: boolean) {
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
  const { lang } = useLanguage();

  return (
    <>
      <section className="rounded-2xl border border-border bg-surface p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted">
            {copy[lang].sectionLabel}
          </p>
        </div>

        <h2 className="mt-3 text-2xl font-bold text-foreground">
          {resolveTitle(lang, status, premium, displayName)}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
          {resolveDescription(lang, status, premium)}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {status === "anonymous" ? (
            <Link
              href="/auth/login?next=%2Fthe-club"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              {copy[lang].loginLabel}
            </Link>
          ) : premium ? (
            <Link
              href="/the-club/library"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              {copy[lang].openLibraryLabel}
            </Link>
          ) : (
            <a
              href={IMAGINE_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center rounded-lg bg-foreground px-8 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
            >
              {copy[lang].upgradeLabel}
            </a>
          )}
          <Link
            href="/episodes"
            className="btn-press inline-flex items-center rounded-lg border border-border px-8 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {copy[lang].galleryLabel}
          </Link>
        </div>
      </section>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        <div className="bg-surface px-6 py-5">
          <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
            {copy[lang].catalogEntriesLabel}
          </dt>
          <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {stats.total}
          </dd>
        </div>
        <div className="bg-surface px-6 py-5">
          <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
            {copy[lang].wallpaperSetsLabel}
          </dt>
          <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {stats.wallpapers}
          </dd>
        </div>
      </dl>
    </>
  );
}
