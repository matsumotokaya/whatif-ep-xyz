import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyDesignsClientOnly } from "@/components/editor/MyDesignsClientOnly";
import { isSizeKeyShape } from "@/components/editor/utils/sizeCategories";

export const metadata: Metadata = {
  title: "My Designs",
  description: "Your saved IMAGINE designs by size.",
  robots: { index: false },
};

// /mydesign/[sizeKey] -> size-filtered design list (IMAGINE's old
// /banners/:sizeKey). The sizeKey is read client-side via the editor's router
// shim useParams(), but its shape is validated here so an unknown path 404s
// instead of rendering an empty list as though it were a real page.
// /mydesign/factory is its own static route and is unaffected.
export default async function MyDesignBySizePage({
  params,
}: {
  params: Promise<{ sizeKey: string }>;
}) {
  const { sizeKey } = await params;
  if (!isSizeKeyShape(sizeKey)) notFound();

  return (
    <Suspense fallback={null}>
      <MyDesignsClientOnly />
    </Suspense>
  );
}
