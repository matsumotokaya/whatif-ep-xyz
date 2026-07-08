import type { Metadata } from "next";
import { Suspense } from "react";
import { ImaginePublicPagesApp } from "@/components/editor/ImaginePublicPagesApp";

export const metadata: Metadata = {
  title: "IMAGINE Specified Commercial Transactions Act",
  description: "Specified Commercial Transactions Act notice for IMAGINE.",
};

export default function ImagineCommercialPage() {
  return (
    <Suspense fallback={null}>
      <ImaginePublicPagesApp page="commercial" />
    </Suspense>
  );
}
