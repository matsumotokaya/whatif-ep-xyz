import type { Metadata } from "next";
import { Suspense } from "react";
import UpdatePasswordPageClient from "./UpdatePasswordPageClient";

export const metadata: Metadata = {
  title: "Set new password",
  description: "Set a new password for your WHATIF account",
};

function UpdatePasswordFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="h-10 w-48 animate-pulse rounded bg-surface" />
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordFallback />}>
      <UpdatePasswordPageClient />
    </Suspense>
  );
}
