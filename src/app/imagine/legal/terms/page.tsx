import type { Metadata } from "next";
import { Suspense } from "react";
import { ImaginePublicPagesApp } from "@/components/editor/ImaginePublicPagesApp";

export const metadata: Metadata = {
  title: "IMAGINE Terms of Service",
  description: "IMAGINE terms of service.",
};

export default function ImagineTermsPage() {
  return (
    <Suspense fallback={null}>
      <ImaginePublicPagesApp page="terms" />
    </Suspense>
  );
}
