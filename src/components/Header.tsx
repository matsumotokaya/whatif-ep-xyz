"use client";

import { useState, useRef, useEffect } from "react";
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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-xl font-bold tracking-wider neon-text-cyan group-hover:opacity-80 transition-opacity">
            WHATIF
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            if ("external" in item && item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isActive ? "text-neon-cyan" : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {!loading && (
            user ? (
              <UserMenu />
            ) : (
              <Link
                href="/auth/login"
                className="text-sm font-medium px-3 py-1.5 border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan hover:text-background transition-colors"
              >
                ログイン
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
