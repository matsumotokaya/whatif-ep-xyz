import type { Metadata } from "next";
import { Suspense } from "react";
import { ImagineLandingApp } from "@/components/editor/ImagineLandingApp";

export const metadata: Metadata = {
  title: "IMAGINE",
  description: "IMAGINE top page for wallpapers, banners, icons, and templates.",
};

export default function ImagineEntryPage() {
  return (
    <Suspense fallback={null}>
      <ImagineLandingApp />
    </Suspense>
  );
}
