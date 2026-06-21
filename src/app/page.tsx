import { redirect } from "next/navigation";

// The domain root now leads straight into the gallery so visitors reach the
// artworks immediately. The previous hero page lives at /about, linked from the
// hamburger menu.
export default function Home() {
  redirect("/works/episode");
}
