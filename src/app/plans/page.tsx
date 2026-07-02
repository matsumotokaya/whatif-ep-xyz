import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPagesClientOnly } from "@/components/editor/AccountPagesClientOnly";

export const metadata: Metadata = {
  title: "Plans",
  description: "WHATIF / IMAGINE plans: guest, free member and premium.",
};

// /plans (was IMAGINE's /upgrade) -> three plan cards + premium checkout via
// the create-checkout-session Edge Function. /upgrade redirects here (see
// next.config.ts).
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <AccountPagesClientOnly page="plans" />
    </Suspense>
  );
}
