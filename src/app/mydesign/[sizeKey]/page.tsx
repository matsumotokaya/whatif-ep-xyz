import type { Metadata } from "next";
import { Suspense } from "react";
import { MyDesignsClientOnly } from "@/components/editor/MyDesignsClientOnly";

export const metadata: Metadata = {
  title: "My Designs",
  description: "Your saved IMAGINE designs by size.",
  robots: { index: false },
};

// /mydesign/[sizeKey] -> size-filtered design list (IMAGINE's old
// /banners/:sizeKey). The sizeKey is read client-side via the editor's router
// shim useParams().
export default function MyDesignBySizePage() {
  return (
    <Suspense fallback={null}>
      <MyDesignsClientOnly />
    </Suspense>
  );
}
