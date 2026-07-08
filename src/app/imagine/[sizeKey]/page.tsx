import type { Metadata } from "next";
import { Suspense } from "react";
import { ImagineTemplatesClientOnly } from "@/components/editor/ImagineTemplatesClientOnly";

export const metadata: Metadata = {
  title: "IMAGINE Templates",
  description: "IMAGINE templates by size.",
};

export default function ImagineTemplatesBySizePage() {
  return (
    <Suspense fallback={null}>
      <ImagineTemplatesClientOnly />
    </Suspense>
  );
}
