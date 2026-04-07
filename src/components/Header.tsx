"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/episodes", label: "Episodes" },
  { href: "/the-club", label: "The Club" },
  { href: "https://whatif.stores.jp", label: "Shop", external: true },
];

function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full focus:outline-none"
        aria-label="アカウントメニュー"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover border border-border"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-neon-cyan text-background text-sm font-bold flex items-center justify-center">
            {initial}
          </span>
        )}
        <span className="text-sm text-foreground hidden sm:block">{displayName}</span>
        <svg
          className={`w-3 h-3 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted truncate">{user?.email}</p>
            {profile?.subscription_tier === "premium" && (
              <span className="text-xs neon-text-cyan">Premium</span>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const loginHref =
    pathname && pathname.startsWith("/") && !pathname.startsWith("//")
      ? `/auth/login?next=${encodeURIComponent(pathname)}`
      : "/auth/login";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, mounted]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4">
        <div className="flex items-center">
          {!loading && (
            user ? (
              <UserMenu />
            ) : (
              <Link
                href={loginHref}
                className="text-sm font-medium px-3 py-1.5 border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan hover:text-background transition-colors"
              >
                ログイン
              </Link>
            )
          )}
        </div>

        <Link href="/" className="group justify-self-center">
          <span className="text-xl font-bold tracking-wider neon-text-cyan group-hover:opacity-80 transition-opacity">
            WHATIF
          </span>
        </Link>

        <div className="flex items-center justify-end">
          <button
            type="button"
            aria-label="メニューを開く"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:text-neon-cyan hover:border-neon-cyan/60 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {mounted &&
        menuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] bg-black/95 text-white">
            <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.4em] text-white/60">
                  Menu
                </span>
                <button
                  type="button"
                  aria-label="メニューを閉じる"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white hover:border-white hover:text-white transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="mt-12 flex flex-col gap-6 text-3xl font-semibold">
                {navItems.map((item) => {
                  const isActive = pathname?.startsWith(item.href);
                  if ("external" in item && item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 text-white/80 hover:text-white transition-colors"
                      >
                        <span>{item.label}</span>
                        <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                          External
                        </span>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`transition-colors ${
                        isActive ? "text-white" : "text-white/80 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
