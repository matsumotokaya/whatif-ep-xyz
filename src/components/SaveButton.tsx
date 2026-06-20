"use client";

import { usePathname } from "next/navigation";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useSavedWorks } from "@/context/SavedWorksContext";

// Localized aria-labels for the bookmark toggle.
const COPY: Record<Language, { save: string; saved: string }> = {
  en: { save: "Save", saved: "Saved" },
  ja: { save: "保存", saved: "保存済み" },
  "zh-CN": { save: "保存", saved: "已保存" },
  "zh-TW": { save: "儲存", saved: "已儲存" },
  ko: { save: "저장", saved: "저장됨" },
};

function BookmarkIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z"
      />
    </svg>
  );
}

interface SaveButtonProps {
  workId: string;
  // "card" sits in a gallery card corner; "detail" sits on the detail image.
  size?: "card" | "detail";
  className?: string;
}

export function SaveButton({
  workId,
  size = "card",
  className = "",
}: SaveButtonProps) {
  const { lang } = useLanguage();
  const t = COPY[lang];
  const { user } = useAuth();
  const { isSaved, toggle } = useSavedWorks();
  const pathname = usePathname();

  const saved = isSaved(workId);

  function handleClick(e: React.MouseEvent) {
    // Cards are wrapped in <Link>; never trigger navigation.
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      const next = pathname ?? "/";
      window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
      return;
    }

    void toggle(workId);
  }

  const iconSize = size === "detail" ? "h-5 w-5" : "h-4 w-4";
  const padding = size === "detail" ? "p-2" : "p-1.5";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? t.saved : t.save}
      aria-pressed={saved}
      className={`btn-press inline-flex items-center justify-center rounded-full border border-border bg-background/70 ${padding} text-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover ${className}`}
    >
      <BookmarkIcon filled={saved} className={iconSize} />
    </button>
  );
}
