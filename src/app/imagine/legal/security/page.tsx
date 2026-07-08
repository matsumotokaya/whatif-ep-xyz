import type { Metadata } from "next";
import { Suspense } from "react";
import { ImaginePublicPagesApp } from "@/components/editor/ImaginePublicPagesApp";

export const metadata: Metadata = {
  title: "IMAGINE Security Policy",
  description: "IMAGINE security policy.",
};

export default function ImagineSecurityPage() {
  return (
    <Suspense fallback={null}>
      <ImaginePublicPagesApp page="security" />
    </Suspense>
  );
}
