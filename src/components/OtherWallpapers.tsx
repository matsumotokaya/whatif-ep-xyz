"use client";

import Link from "next/link";
import Image from "next/image";
import type { WallpaperCoverItem } from "@/lib/types";
import { useLanguage, type Language } from "@/context/LanguageContext";

// Section title for the wallpaper-cover strip below the download block.
const COPY: Record<Language, { title: string }> = {
  en: { title: "Other wallpapers" },
  ja: { title: "その他の壁紙" },
  "zh-CN": { title: "其他壁纸" },
  "zh-TW": { title: "其他桌布" },
  ko: { title: "다른 배경화면" },
};

// Wallpaper sales page for a pack (variant query only when not the first).
function wallpaperHref(item: WallpaperCoverItem): string {
  const suffix = item.variantNumber > 1 ? `?variant=${item.variantNumber}` : "";
  return `/works/${item.seriesSlug}/${item.displayCode}/wallpaper${suffix}`;
}

// One square wallpaper-cover tile linking straight to the pack's sales page.
function CoverTile({ item }: { item: WallpaperCoverItem }) {
  return (
    <Link
      href={wallpaperHref(item)}
      aria-label={`#${item.displayCode} ${item.title}`}
      className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-surface"
    >
      <Image
        src={item.coverUrl}
        alt={`${item.title} wallpaper`}
        fill
        sizes="120px"
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        loading="lazy"
      />
    </Link>
  );
}

interface OtherWallpapersProps {
  items: WallpaperCoverItem[];
}

export function OtherWallpapers({ items }: OtherWallpapersProps) {
  const { lang } = useLanguage();
  const t = COPY[lang];

  if (items.length === 0) return null;

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="text-xs font-medium text-foreground">{t.title}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map((item) => (
          <CoverTile key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
