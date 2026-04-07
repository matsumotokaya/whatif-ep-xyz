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

  if (isEpisodeDetail) return null;
  return <Footer />;
}
