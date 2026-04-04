import type { Metadata } from "next";
import { Suspense } from "react";
import LegacyLoginPageClient from "./LegacyLoginPageClient";

export const metadata: Metadata = {
  title: "Legacy Login",
  description: "Legacy The Club member login",
};

function LegacyLoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="h-10 w-48 animate-pulse rounded bg-surface" />
    </div>
  );
}

export default function LegacyLoginPage() {
  return (
    <Suspense fallback={<LegacyLoginFallback />}>
      <LegacyLoginPageClient />
    </Suspense>
  );
}
