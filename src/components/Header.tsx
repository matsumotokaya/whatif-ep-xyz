"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
        <div className="dropdown-enter absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-xs text-muted">{user?.email}</p>
            {profile?.subscription_tier === "premium" && (
              <span className="mt-0.5 inline-block text-[11px] font-medium text-foreground">
                Premium
              </span>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
          >
            Log out
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
  const [menuClosing, setMenuClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loginHref =
    pathname && pathname.startsWith("/") && !pathname.startsWith("//")
      ? `/auth/login?next=${encodeURIComponent(pathname)}`
      : "/auth/login";

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 180);
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
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4">
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
                Log in
              </Link>
            ))}
        </div>

        {/* Center: logo */}
        <Link href="/" className="group justify-self-center">
          <span className="text-lg font-bold tracking-[0.2em] text-foreground transition-opacity group-hover:opacity-60">
            WHATIF
          </span>
        </Link>

        {/* Right: hamburger with morphing animation */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            className="btn-press relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-hover"
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
      {mounted &&
        menuOpen &&
        createPortal(
          <div
            className={`fixed inset-0 z-[60] bg-background ${
              menuClosing ? "menu-overlay-exit" : "menu-overlay-enter"
            }`}
          >
            <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.4em] text-muted">
                  Menu
                </span>
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

              {/* Nav items with staggered slide-in */}
              <nav className="mt-16 flex flex-col gap-1">
                {navItems.map((item, i) => {
                  const isActive = pathname?.startsWith(item.href);
                  const delay = `${80 + i * 60}ms`;

                  if ("external" in item && item.external) {
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
                        <span className="text-2xl font-semibold tracking-tight sm:text-3xl">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-2 text-muted">
                          <span className="text-[11px] uppercase tracking-[0.2em]">
                            External
                          </span>
                          <svg
                            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
                        </div>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMenu}
                      className={`menu-item-slide group flex items-center justify-between rounded-xl px-4 py-4 transition-colors hover:bg-surface-hover ${
                        isActive ? "text-foreground" : "text-muted"
                      }`}
                      style={{ animationDelay: delay }}
                    >
                      <span className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        {item.label}
                      </span>
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

              {/* Bottom branding */}
              <div className="mt-auto pt-8">
                <div className="border-t border-border pt-6">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
                    &copy; {new Date().getFullYear()} WHATIF EP
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
