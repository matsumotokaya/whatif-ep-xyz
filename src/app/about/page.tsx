import type { Metadata } from "next";
import { HomeHeroWithBanner } from "@/components/HomeHeroWithBanner";

const description =
  "About WHATIF — an AI-driven digital art project of original illustrations, wallpapers, and the IMAGINE design tool.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About WHATIF",
    description,
    type: "website",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <h1 className="sr-only">About WHATIF</h1>
      <HomeHeroWithBanner />
      {/* Future: add the About Us narrative (story, team, what we make) as
          sections below the hero here. */}
    </>
  );
}
