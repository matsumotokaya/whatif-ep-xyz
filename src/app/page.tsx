import { ParallaxHero } from "@/components/ParallaxHero";
import dynamic from "next/dynamic";

const ImagineBanner = dynamic(
  () => import("@/components/ImagineBanner").then((mod) => mod.ImagineBanner),
  { ssr: false }
);

export default function Home() {
  return (
    <>
      <ParallaxHero />
      <ImagineBanner />
    </>
  );
}
