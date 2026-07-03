import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPagesClientOnly } from "@/components/editor/AccountPagesClientOnly";

export const metadata: Metadata = {
  title: "Payment Complete",
  description: "Subscription checkout completed.",
  robots: { index: false },
};

// /success -> Stripe subscription checkout return page. Distinct from the
// wallpaper one-off purchase flow, which returns to
// /works/[series]/[code]/wallpaper?purchased=1 (no route collision).
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <AccountPagesClientOnly page="success" />
    </Suspense>
  );
}
