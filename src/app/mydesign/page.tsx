import type { Metadata } from "next";
import { Suspense } from "react";
import { MyDesignsClientOnly } from "@/components/editor/MyDesignsClientOnly";

export const metadata: Metadata = {
  title: "My Designs",
  description: "Your saved IMAGINE designs.",
  robots: { index: false },
};

// /mydesign -> saved designs of the logged-in user (Supabase banners), or the
// single guest design kept in localStorage for logged-out visitors.
export default function MyDesignPage() {
  return (
    <Suspense fallback={null}>
      <MyDesignsClientOnly />
    </Suspense>
  );
}
