"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type NavItemKey = "episodes" | "imagine" | "club" | "store" | "about";

const navItems = [
  { key: "episodes" as NavItemKey, href: "/works/episode" },
  { key: "imagine" as NavItemKey, href: "https://app.whatif-ep.xyz/", external: true },
  { key: "club" as NavItemKey, href: "/the-club" },
  { key: "store" as NavItemKey, href: "https://whatif.stores.jp", external: true },
  { key: "about" as NavItemKey, href: "/about" },
];

// Localized labels for the header chrome (menu heading, auth actions).
const chromeCopy: Record<
  Language,
  {
    menu: string;
    login: string;
    logout: string;
    account: string;
    addEpisode: string;
  }
> = {
  en: { menu: "Menu", login: "Log in", logout: "Log out", account: "My account", addEpisode: "Add episode" },
  ja: { menu: "メニュー", login: "ログイン", logout: "ログアウト", account: "マイアカウント", addEpisode: "エピソードを追加" },
  "zh-CN": { menu: "菜单", login: "登录", logout: "退出登录", account: "我的账户", addEpisode: "添加作品" },
  "zh-TW": { menu: "選單", login: "登入", logout: "登出", account: "我的帳戶", addEpisode: "新增作品" },
  ko: { menu: "메뉴", login: "로그인", logout: "로그아웃", account: "내 계정", addEpisode: "에피소드 추가" },
};

const menuCopy: Record<
  Language,
  Record<NavItemKey, { label: string; description: string }>
> = {
  en: {
    episodes: {
      label: "EPISODES",
      description:
        "A gallery of WHATIF artworks shared on Instagram and Threads. Selected images are available for download.",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "A free design site where you can create illustrations from 99% complete design kits. Build original designs using WHATIF artwork assets.",
    },
    club: {
      label: "THE CLUB",
      description:
        "A members-only wallpaper download service for Instagram subscription members. Accounts are now shared with Imagine, and paid Imagine users get unlimited wallpaper downloads.",
    },
    store: {
      label: "STORE",
      description:
        "Shop fashion items like T-shirts and sweatshirts featuring WHATIF artwork, plus downloadable items such as wallpapers and digital books.",
    },
    about: {
      label: "ABOUT",
      description:
        "The story behind WHATIF — an AI-driven art project. Learn who we are and what we make.",
    },
  },
  ja: {
    episodes: {
      label: "エピソード",
      description:
        "Instagram と Threads で公開している WHATIF のアートワークギャラリーです。一部画像はダウンロードできます。",
    },
    imagine: {
      label: "Imagine",
      description:
        "99%完成済みのデザインキットから自由にイラストを作れる無料デザインサイトです。WHATIFのアートワーク素材でオリジナルデザインを作成できます。",
    },
    club: {
      label: "ザ・クラブ",
      description:
        "会員制の壁紙ダウンロードサービスです。Instagramサブスク会員向けプランに加え、Imagineとのアカウント共有に対応しています。Imagine有料プランなら壁紙をダウンロードし放題です。",
    },
    store: {
      label: "ストア",
      description:
        "WHATIFアートワークを使ったTシャツやスウェットなどのファッションアイテムに加え、壁紙や電子書籍などのダウンロード商品も購入できます。",
    },
    about: {
      label: "ABOUT",
      description:
        "WHATIF について。AIを活用したアートプロジェクトの背景や、私たちが作っているものを紹介します。",
    },
  },
  "zh-CN": {
    episodes: {
      label: "EPISODES",
      description:
        "在 Instagram 与 Threads 上发布的 WHATIF 作品画廊。部分图片可供下载。",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "可从 99% 完成的设计套件自由创作插画的免费设计网站。使用 WHATIF 作品素材打造原创设计。",
    },
    club: {
      label: "THE CLUB",
      description:
        "面向 Instagram 订阅会员的会员制壁纸下载服务。账号现已与 Imagine 互通，Imagine 付费用户可无限下载壁纸。",
    },
    store: {
      label: "STORE",
      description:
        "选购采用 WHATIF 作品的 T 恤、卫衣等时尚单品，以及壁纸、电子书等可下载商品。",
    },
    about: {
      label: "ABOUT",
      description:
        "关于 WHATIF。介绍这个由 AI 驱动的艺术项目的背景，以及我们所创作的内容。",
    },
  },
  "zh-TW": {
    episodes: {
      label: "EPISODES",
      description:
        "在 Instagram 與 Threads 上發布的 WHATIF 作品藝廊。部分圖片可供下載。",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "可從 99% 完成的設計套件自由創作插畫的免費設計網站。使用 WHATIF 作品素材打造原創設計。",
    },
    club: {
      label: "THE CLUB",
      description:
        "面向 Instagram 訂閱會員的會員制桌布下載服務。帳號現已與 Imagine 互通，Imagine 付費使用者可無限下載桌布。",
    },
    store: {
      label: "STORE",
      description:
        "選購採用 WHATIF 作品的 T 恤、衛衣等時尚單品，以及桌布、電子書等可下載商品。",
    },
    about: {
      label: "ABOUT",
      description:
        "關於 WHATIF。介紹這個由 AI 驅動的藝術專案的背景，以及我們所創作的內容。",
    },
  },
  ko: {
    episodes: {
      label: "EPISODES",
      description:
        "Instagram과 Threads에 공개한 WHATIF 아트워크 갤러리입니다. 일부 이미지는 다운로드할 수 있습니다.",
    },
    imagine: {
      label: "/IMAGINE",
      description:
        "99% 완성된 디자인 키트로 자유롭게 일러스트를 만들 수 있는 무료 디자인 사이트입니다. WHATIF 아트워크 소재로 오리지널 디자인을 제작하세요.",
    },
    club: {
      label: "THE CLUB",
      description:
        "Instagram 구독 회원을 위한 회원제 배경화면 다운로드 서비스입니다. 이제 Imagine과 계정을 공유하며, Imagine 유료 회원은 배경화면을 무제한으로 다운로드할 수 있습니다.",
    },
    store: {
      label: "STORE",
      description:
        "WHATIF 아트워크를 활용한 티셔츠, 스웨트셔츠 등 패션 아이템과 배경화면, 전자책 등 다운로드 상품을 구매할 수 있습니다.",
    },
    about: {
      label: "ABOUT",
      description:
        "WHATIF 소개. AI를 활용한 아트 프로젝트의 배경과 우리가 만드는 것을 소개합니다.",
    },
  },
};

const socialLinks = [
  {
    href: "https://www.instagram.com/whatif.ep/",
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    href: "https://www.threads.com/@whatif.ep",
    label: "Threads",
    icon: (
      <svg viewBox="0 0 192 192" fill="currentColor" className="h-5 w-5">
        <path d="M141.537 88.988a66.667 66.667 0 0 0-1.518-.94c-1.482-27.307-16.403-42.94-41.457-43.1h-.37c-14.985 0-27.449 6.396-35.12 17.36l13.779 9.452c5.73-8.695 14.724-10.548 21.347-10.548h.25c8.25.055 14.474 2.454 18.503 7.13 2.932 3.406 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.625-23.68-1.14-23.82 1.372-39.134 15.265-38.105 34.569.517 9.792 5.395 18.216 13.73 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.23-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.17-40.06-7.485-51.275-21.742C35.236 139.966 29.808 120.682 29.606 96c.202-24.682 5.63-43.966 16.132-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.861 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.131C68.882.194 47.292 9.642 32.788 28.079 19.882 44.486 13.224 67.316 13.001 95.932L13 96l.001.068c.223 28.616 6.881 51.446 19.787 67.853 14.504 18.437 36.094 27.885 64.169 28.079h.131c25.025-.173 42.619-6.708 57.113-21.189 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-13.033-19.044-24.806-24.553zm-40.093 40.52c-10.44.587-21.286-4.099-21.821-14.136-.384-7.442 5.308-15.746 22.473-16.735 1.966-.113 3.895-.168 5.79-.168 6.235 0 12.068.606 17.371 1.765-1.978 24.702-13.715 28.713-23.813 29.274z" />
      </svg>
    ),
  },
];

// Crown icon (filled), used to mark premium accounts.
function CrownIcon({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path d="M3 7l4 4 5-7 5 7 4-4-1.6 11H4.6L3 7zm1.8 13h14.4v1.2a.8.8 0 01-.8.8H5.6a.8.8 0 01-.8-.8V20z" />
    </svg>
  );
}

function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  };

  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url;
  const initial = displayName.charAt(0).toUpperCase();
  const isPremium = profile?.subscription_tier === "premium";
  const isAdmin = profile?.role === "admin";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-press flex items-center gap-2 rounded-full focus:outline-none"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
            {initial}
          </span>
        )}
        <span className="hidden text-sm text-foreground sm:block">
          {displayName}
        </span>
        {isPremium && (
          <CrownIcon
            className="h-4 w-4 shrink-0 text-amber-400"
            aria-label="Premium"
          />
        )}
        <svg
          className={`h-3 w-3 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="dropdown-enter absolute left-0 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-xs text-muted">{user?.email}</p>
            {isPremium && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
                <CrownIcon className="h-3 w-3" />
                Premium
              </span>
            )}
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block w-full px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
          >
            {chromeCopy[lang].account}
          </Link>
          {isAdmin && (
            <Link
              href="/episodes/new"
              onClick={() => setOpen(false)}
              className="block w-full border-t border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              {chromeCopy[lang].addEpisode}
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="w-full border-t border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
          >
            {chromeCopy[lang].logout}
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  // Transparent header over the full-screen hero. The root redirects to the
  // gallery, but the hero page now lives at /about.
  const isHome = pathname === "/" || pathname === "/about";
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);

  const loginHref =
    pathname && pathname.startsWith("/") && !pathname.startsWith("//")
      ? `/auth/login?next=${encodeURIComponent(pathname)}`
      : "/auth/login";

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 180);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={`fixed top-0 z-50 w-full transition-colors ${isHome ? "" : "border-b border-border bg-background/80 backdrop-blur-md"}`}>
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4">
        {/* Left: user menu or login */}
        <div className="flex items-center">
          {!loading &&
            (user ? (
              <UserMenu />
            ) : (
              <Link
                href={loginHref}
                className="btn-press rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {chromeCopy[lang].login}
              </Link>
            ))}
        </div>

        {/* Center: logo */}
        <Link href="/" className="group justify-self-center">
          <span className="text-lg font-bold tracking-[0.2em] text-foreground transition-opacity group-hover:opacity-60">
            WHATIF
          </span>
        </Link>

        {/* Right: language switcher + hamburger with morphing animation */}
        <div className="flex items-center justify-end gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            className={`btn-press relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-hover ${isHome ? "bg-background" : ""}`}
          >
            <span className="flex h-4 w-5 flex-col items-center justify-center">
              <span
                className={`block h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  menuOpen
                    ? "translate-y-[3px] rotate-45"
                    : "translate-y-[-3px]"
                }`}
              />
              <span
                className={`block h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  menuOpen ? "scale-x-0 opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  menuOpen
                    ? "-translate-y-[3px] -rotate-45"
                    : "translate-y-[3px]"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Full-screen menu overlay via portal */}
      {menuOpen &&
        createPortal(
          <div
            className={`fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-background ${
              menuClosing ? "menu-overlay-exit" : "menu-overlay-enter"
            }`}
          >
            <div className="mx-auto flex min-h-full max-w-5xl flex-col px-6 py-8">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.4em] text-muted">
                  {chromeCopy[lang].menu}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={closeMenu}
                    className="btn-press flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Nav items with staggered slide-in */}
              <nav className="mt-12 flex flex-col">
                {navItems.map((item, i) => {
                  const copy = menuCopy[lang][item.key];
                  const isActive = !item.external && pathname?.startsWith(item.href);
                  const delay = `${80 + i * 60}ms`;

                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMenu}
                        className="menu-item-slide group flex items-center justify-between rounded-xl px-4 py-4 text-foreground transition-colors hover:bg-surface-hover"
                        style={{ animationDelay: delay }}
                      >
                        <div className="flex max-w-3xl flex-col gap-1.5">
                          <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                            {copy.label}
                          </span>
                          <span className="text-sm leading-relaxed text-muted">
                            {copy.description}
                          </span>
                        </div>
                        <svg
                          className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                          />
                        </svg>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMenu}
                      className={`menu-item-slide group flex items-center justify-between rounded-xl px-4 py-4 transition-colors hover:bg-surface-hover ${
                        isActive ? "text-foreground" : "text-foreground"
                      }`}
                      style={{ animationDelay: delay }}
                    >
                      <div className="flex max-w-3xl flex-col gap-1.5">
                        <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                          {copy.label}
                        </span>
                        <span className="text-sm leading-relaxed text-muted">
                          {copy.description}
                        </span>
                      </div>
                      <svg
                        className="h-5 w-5 text-muted opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom: social links + branding */}
              <div className="mt-auto pt-8">
                <div className="border-t border-border pt-6 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
                    &copy; {new Date().getFullYear()} WHATIF EP
                  </p>
                  <div className="flex items-center gap-4">
                    {socialLinks.map((social) => (
                      <a
                        key={social.href}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className="text-muted transition-colors hover:text-foreground"
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
