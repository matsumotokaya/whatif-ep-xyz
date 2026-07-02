import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPagesClientOnly } from "@/components/editor/AccountPagesClientOnly";

export const metadata: Metadata = {
  title: "My Page",
  description: "Manage your WHATIF account and subscription.",
  robots: { index: false },
};

// /mypage -> account info + Stripe Customer Portal entry (login required;
// guests are redirected to /auth/login?next=/mypage inside the island).
export default function MyPagePage() {
  return (
    <Suspense fallback={null}>
      <AccountPagesClientOnly page="mypage" />
    </Suspense>
  );
}
