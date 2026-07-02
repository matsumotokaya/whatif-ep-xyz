import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPagesClientOnly } from "@/components/editor/AdminPagesClientOnly";

export const metadata: Metadata = {
  title: "Cover Lab",
  description: "Package cover layout preview lab.",
  robots: { index: false },
};

// /admin/cover-lab -> package cover layout tuning preview (admin only).
export default function CoverLabPage() {
  return (
    <Suspense fallback={null}>
      <AdminPagesClientOnly page="cover-lab" />
    </Suspense>
  );
}
