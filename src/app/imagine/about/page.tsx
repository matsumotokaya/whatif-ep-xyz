import type { Metadata } from "next";
import { Suspense } from "react";
import { ImaginePublicPagesApp } from "@/components/editor/ImaginePublicPagesApp";

export const metadata: Metadata = {
  title: "About IMAGINE",
  description: "Learn more about IMAGINE and the creative work behind WHATIF.",
};

export default function ImagineAboutPage() {
  return (
    <Suspense fallback={null}>
      <ImaginePublicPagesApp page="about" />
    </Suspense>
  );
}
