import type { Metadata } from "next";
import ResetPasswordPageClient from "./ResetPasswordPageClient";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your WHATIF account password",
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
