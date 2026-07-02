import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPagesClientOnly } from "@/components/editor/AdminPagesClientOnly";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "WHATIF admin dashboard.",
  robots: { index: false },
};

// /admin -> resource monitoring dashboard. Non-admins are redirected to /
// inside the island (profiles.role gate).
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPagesClientOnly page="dashboard" />
    </Suspense>
  );
}
