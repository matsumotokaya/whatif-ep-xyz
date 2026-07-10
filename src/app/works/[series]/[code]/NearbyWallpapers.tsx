import { getNearbyWallpapers } from "@/lib/works";
import { OtherWallpapers } from "@/components/OtherWallpapers";

interface NearbyWallpapersProps {
  seriesSlug: string;
  workId: string;
  sequenceNumber: number;
  count?: number;
}

// This section is below the primary detail actions. Keep its data request out
// of the critical path so the artwork and download/edit controls can stream
// before the related-wallpaper query finishes.
export async function NearbyWallpapers({
  seriesSlug,
  workId,
  sequenceNumber,
  count = 9,
}: NearbyWallpapersProps) {
  const items = await getNearbyWallpapers(
    seriesSlug,
    workId,
    sequenceNumber,
    count
  );
  return <OtherWallpapers items={items} />;
}
