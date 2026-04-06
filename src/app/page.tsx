import { getTotalCount } from "@/lib/episodes";
import { ParallaxHero } from "@/components/ParallaxHero";

export default function Home() {
  const totalEpisodes = getTotalCount();

  return <ParallaxHero totalEpisodes={totalEpisodes} />;
}
