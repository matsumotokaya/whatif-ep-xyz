import type { Metadata } from "next";
import { Suspense } from "react";
import PlansPageClient from "./PlansPageClient";

export const metadata: Metadata = {
  title: "Plans — WHATIF",
  description: "WHATIF plans: free account and Premium membership.",
};

// /plans (was IMAGINE's /upgrade) -> Free vs. Premium comparison + premium
// checkout via the authenticated Next.js subscription Checkout route.
// /upgrade redirects here (see next.config.ts).
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansPageClient />
    </Suspense>
  );
}
