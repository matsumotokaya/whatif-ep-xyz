import type { Metadata } from "next";
import { Suspense } from "react";
import { EditClientOnly } from "@/components/editor/EditClientOnly";

export const metadata: Metadata = {
  title: "Editor",
  description: "Edit templates and create your own designs with IMAGINE.",
  robots: { index: false },
};

// /edit/[id] -> open a saved banner (requires login; id read client-side via
// the editor's router shim useParams()).
export default function EditBannerPage() {
  return (
    <Suspense fallback={null}>
      <EditClientOnly />
    </Suspense>
  );
}
