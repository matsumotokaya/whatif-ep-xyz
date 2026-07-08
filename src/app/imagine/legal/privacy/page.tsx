import type { Metadata } from "next";
import { Suspense } from "react";
import { ImaginePublicPagesApp } from "@/components/editor/ImaginePublicPagesApp";

export const metadata: Metadata = {
  title: "IMAGINE Privacy Policy",
  description: "IMAGINE privacy policy.",
};

export default function ImaginePrivacyPage() {
  return (
    <Suspense fallback={null}>
      <ImaginePublicPagesApp page="privacy" />
    </Suspense>
  );
}
