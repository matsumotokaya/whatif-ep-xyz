"use client";

import dynamic from "next/dynamic";

const EditPoc = dynamic(() => import("./EditPoc").then((mod) => mod.EditPoc), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 text-sm text-muted">
      Loading editor runtime...
    </div>
  ),
});

export function EditClientOnly() {
  return <EditPoc />;
}
