"use client";

// Gallery (WHATIF) site footer.
//
// Content/structure is ported from the IMAGINE shell footer
// (src/components/editor/components/Footer.tsx) — that one stays as-is for
// IMAGINE-shell pages (/edit, /mydesign, /plans, /success, /admin/*, and the
// ported IMAGINE public pages under /imagine/*). This is the WHATIF-toned
// counterpart for the Gallery shell, using the shared border/surface/
// foreground/muted design tokens instead of IMAGINE's dark #101010 theme.
//
// "Release Notes" (IMAGINE editor changelog) was dropped — it doesn't apply
// to the Gallery shell. Everything else (social links, legal pages, language
// switcher) carries over.

import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage, type Language } from "@/context/LanguageContext";

const COPY: Record<Language, {
  tagline: string;
  aboutUs: string;
  imagine: string;
  mcp: string;
  contact: string;
  privacyPolicy: string;
  termsOfService: string;
  securityPolicy: string;
  legalInfo: string;
  copyright: string;
}> = {
  en: {
    tagline: "An AI-driven art project.",
    aboutUs: "About Us",
    imagine: "IMAGINE",
    mcp: "MCP",
    contact: "Contact",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    securityPolicy: "Security Policy",
    legalInfo: "Legal Info",
    copyright: "© WHATIF. All rights reserved.",
  },
  ja: {
    tagline: "AIを活用したアートプロジェクト。",
    aboutUs: "About Us",
    imagine: "IMAGINE",
    mcp: "MCP",
    contact: "お問い合わせ",
    privacyPolicy: "プライバシーポリシー",
    termsOfService: "利用規約",
    securityPolicy: "セキュリティポリシー",
    legalInfo: "特定商取引法に基づく表記",
    copyright: "© WHATIF. All rights reserved.",
  },
  "zh-CN": {
    tagline: "由 AI 驱动的艺术项目。",
    aboutUs: "关于我们",
    imagine: "IMAGINE",
    mcp: "MCP",
    contact: "联系我们",
    privacyPolicy: "隐私政策",
    termsOfService: "服务条款",
    securityPolicy: "安全政策",
    legalInfo: "法律信息",
    copyright: "© WHATIF. All rights reserved.",
  },
  "zh-TW": {
    tagline: "由 AI 驅動的藝術專案。",
    aboutUs: "關於我們",
    imagine: "IMAGINE",
    mcp: "MCP",
    contact: "聯絡我們",
    privacyPolicy: "隱私政策",
    termsOfService: "服務條款",
    securityPolicy: "安全政策",
    legalInfo: "法律資訊",
    copyright: "© WHATIF. All rights reserved.",
  },
  ko: {
    tagline: "AI 기반 아트 프로젝트.",
    aboutUs: "회사 소개",
    imagine: "IMAGINE",
    mcp: "MCP",
    contact: "문의하기",
    privacyPolicy: "개인정보 처리방침",
    termsOfService: "이용약관",
    securityPolicy: "보안 정책",
    legalInfo: "법적 고지",
    copyright: "© WHATIF. All rights reserved.",
  },
};

function InstagramIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 192 192" aria-hidden="true">
      <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.723-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.13 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.194 47.292 9.642 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.173 42.554-6.708 57.048-21.19 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-11.991-18.842-21.723-24.552Z" />
      <path d="M102.378 125.838c-11.315.613-23.712-4.135-24.705-13.768-.531-5.166 1.906-9.925 6.866-13.396 5.025-3.517 11.578-5.253 19.467-5.158 5.89.071 11.507.839 16.678 2.276-1.962 19.569-9.046 29.413-18.306 30.046Z" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

export function Footer() {
  const { lang } = useLanguage();
  const t = COPY[lang];

  return (
    <footer className="mt-auto border-t border-border bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-lg font-bold tracking-[0.2em] text-foreground">
              WHATIF
            </span>
            <p className="mb-4 mt-2 text-sm text-muted">{t.tagline}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
              <a
                href="https://www.instagram.com/whatif.ep/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
              >
                <InstagramIcon />
                whatif.ep
              </a>
              <a
                href="https://www.threads.com/@whatif.ep"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
              >
                <ThreadsIcon />
                whatif.ep
              </a>
              <a
                href="https://whatif.stores.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
              >
                <StoreIcon />
                Store
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-8 md:flex-row md:gap-16">
            <div className="flex flex-col items-center gap-4 md:items-start">
              <Link href="/about" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.aboutUs}
              </Link>
              <Link href="/imagine" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.imagine}
              </Link>
              <Link href="/imagine/mcp" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.mcp}
              </Link>
              <Link href="/imagine/contact" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.contact}
              </Link>
            </div>
            <div className="flex flex-col items-center gap-4 md:items-start">
              <Link href="/imagine/legal/privacy" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.privacyPolicy}
              </Link>
              <Link href="/imagine/legal/terms" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.termsOfService}
              </Link>
              <Link href="/imagine/legal/security" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.securityPolicy}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 border-t border-border pt-8 md:flex-row md:justify-between">
          <p className="text-xs text-muted">{t.copyright}</p>
          <div className="flex items-center gap-4">
            <LanguageSwitcher dropUp />
            <Link
              href="/imagine/legal/specified-commercial-transactions-act"
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              {t.legalInfo}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
