"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const isEpisodeDetail =
    segments[0] === "episodes" &&
    segments.length === 2 &&
    /^\d{4,}$/.test(segments[1]);
  const isWorkDetail =
    segments[0] === "works" &&
    segments.length === 3 &&
    segments[1].length > 0 &&
    segments[2].length > 0;

  if (isEpisodeDetail || isWorkDetail) return null;
  return <Footer />;
}
