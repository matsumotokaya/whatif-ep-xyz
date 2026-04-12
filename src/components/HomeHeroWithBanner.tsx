"use client";

import dynamic from "next/dynamic";
import { ParallaxHero } from "@/components/ParallaxHero";

const ImagineBanner = dynamic(
  () => import("@/components/ImagineBanner").then((mod) => mod.ImagineBanner),
  { ssr: false }
);

export function HomeHeroWithBanner() {
  return (
    <>
      <ParallaxHero />
      <ImagineBanner />
    </>
  );
}
