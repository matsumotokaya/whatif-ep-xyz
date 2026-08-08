import { redirect } from "next/navigation";

// /mypage was the ported IMAGINE account page (own design system, own
// react-i18next instance). It has been superseded by the Gallery-native
// /account page, which both headers already link to. Keep this route as a
// permanent redirect rather than a 404 for anyone with an old bookmark or
// link, and for any remaining internal default (Stripe portal return,
// post-upgrade return) that still points here.
export default function MyPagePage() {
  redirect("/account");
}
