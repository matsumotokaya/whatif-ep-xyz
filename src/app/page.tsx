import type { Metadata } from "next";
import { HomeHeroWithBanner } from "@/components/HomeHeroWithBanner";

export const metadata: Metadata = {
  title: "WHATIF Gallery",
  description:
    "WHATIF EP - a digital art gallery of original illustrations, wallpapers, and IMAGINE works.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "WHATIF Gallery",
    description:
      "WHATIF EP - a digital art gallery of original illustrations, wallpapers, and IMAGINE works.",
    type: "website",
    url: "/",
  },
};

export default function Home() {
  return (
    <>
      <h1 className="sr-only">WHATIF Gallery - Digital Art Gallery</h1>
      <HomeHeroWithBanner />
    </>
  );
}
