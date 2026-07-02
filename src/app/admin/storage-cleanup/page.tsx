import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPagesClientOnly } from "@/components/editor/AdminPagesClientOnly";

export const metadata: Metadata = {
  title: "Storage Cleanup",
  description: "Purge regenerable and orphaned storage files.",
  robots: { index: false },
};

// /admin/storage-cleanup -> legacy Supabase user-images purge tool (admin only).
export default function StorageCleanupPage() {
  return (
    <Suspense fallback={null}>
      <AdminPagesClientOnly page="storage-cleanup" />
    </Suspense>
  );
}
