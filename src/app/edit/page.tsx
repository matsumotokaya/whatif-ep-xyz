import type { Metadata } from "next";
import { Suspense } from "react";
import { EditClientOnly } from "@/components/editor/EditClientOnly";

export const metadata: Metadata = {
  title: "Editor",
  description: "Edit templates and create your own designs with IMAGINE.",
  robots: { index: false },
};

// /edit           -> guest design (localStorage) or ?template=<id> direct open
// /edit?template= -> open an existing template (Gallery "Edit in IMAGINE")
export default function EditPage() {
  return (
    <Suspense fallback={null}>
      <EditClientOnly />
    </Suspense>
  );
}
