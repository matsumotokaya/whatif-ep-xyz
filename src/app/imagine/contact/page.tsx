import type { Metadata } from "next";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "Contact — WHATIF",
  description: "Contact WHATIF.",
};

export default function ImagineContactPage() {
  return <ContactPageClient />;
}
