import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImagineTemplatesClientOnly } from "@/components/editor/ImagineTemplatesClientOnly";
import { isSizeKeyShape } from "@/components/editor/utils/sizeCategories";

export const metadata: Metadata = {
  title: "IMAGINE Templates",
  description: "IMAGINE templates by size.",
};

export default async function ImagineTemplatesBySizePage({
  params,
}: {
  params: Promise<{ sizeKey: string }>;
}) {
  const { sizeKey } = await params;
  if (!isSizeKeyShape(sizeKey)) notFound();

  return (
    <Suspense fallback={null}>
      <ImagineTemplatesClientOnly />
    </Suspense>
  );
}
