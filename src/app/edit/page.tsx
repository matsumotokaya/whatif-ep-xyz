import type { Metadata } from "next";
import { Suspense } from "react";
import { EditClientOnly } from "@/components/editor-poc/EditClientOnly";

export const metadata: Metadata = {
  title: "Edit PoC",
  description: "Client-only editor integration proof of concept.",
};

export default function EditPage() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted">Loading editor...</div>}>
      <EditClientOnly />
    </Suspense>
  );
}
