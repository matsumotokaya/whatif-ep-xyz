import type { MetadataRoute } from "next";
import { getGallerySeries, getWorksBySeries } from "@/lib/works";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://whatif-ep.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/the-club`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // All public series (cached) — used for both the listing URLs and as the
  // source of published works per series.
  const series = await getGallerySeries();

  const seriesEntries: MetadataRoute.Sitemap = series.map((item) => ({
    url: `${SITE_URL}/works/${item.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Published works per series (reuses the same cached query as the pages).
  const worksPerSeries = await Promise.all(
    series.map((item) => getWorksBySeries(item.slug, "newest"))
  );

  const workEntries: MetadataRoute.Sitemap = worksPerSeries.flat().map((work) => ({
    url: `${SITE_URL}/works/${work.seriesSlug}/${work.displayCode}`,
    lastModified: work.updatedAt ? new Date(work.updatedAt) : now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...seriesEntries, ...workEntries];
}
