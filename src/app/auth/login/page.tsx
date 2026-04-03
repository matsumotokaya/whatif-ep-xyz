import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";

export const metadata: Metadata = {
  title: "Login",
  description: "WHATIF account login",
};

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="h-10 w-48 animate-pulse rounded bg-surface" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
