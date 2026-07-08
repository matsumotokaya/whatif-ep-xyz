import type { Metadata } from "next";
import { Suspense } from "react";
import { ImaginePublicPagesApp } from "@/components/editor/ImaginePublicPagesApp";

export const metadata: Metadata = {
  title: "IMAGINE Contact",
  description: "Contact IMAGINE.",
};

export default function ImagineContactPage() {
  return (
    <Suspense fallback={null}>
      <ImaginePublicPagesApp page="contact" />
    </Suspense>
  );
}
