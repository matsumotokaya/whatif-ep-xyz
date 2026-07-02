import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPagesClientOnly } from "@/components/editor/AdminPagesClientOnly";

export const metadata: Metadata = {
  title: "Factory Projects",
  description: "Content Factory production project list.",
  robots: { index: false },
};

// /mydesign/factory -> production project list with publish/delete/metadata
// actions (admin only; non-admins are redirected to /mydesign inside the
// island). This static segment takes precedence over /mydesign/[sizeKey].
export default function FactoryProjectsPage() {
  return (
    <Suspense fallback={null}>
      <AdminPagesClientOnly page="factory-projects" />
    </Suspense>
  );
}
