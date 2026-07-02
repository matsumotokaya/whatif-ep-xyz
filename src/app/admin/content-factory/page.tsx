import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPagesClientOnly } from "@/components/editor/AdminPagesClientOnly";

export const metadata: Metadata = {
  title: "Content Factory",
  description: "WHATIF Content Factory admin.",
  robots: { index: false },
};

// /admin/content-factory -> official asset intake + production project
// creation (admin only; gated inside the island).
export default function ContentFactoryPage() {
  return (
    <Suspense fallback={null}>
      <AdminPagesClientOnly page="content-factory" />
    </Suspense>
  );
}
