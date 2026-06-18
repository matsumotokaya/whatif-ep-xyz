import { redirect } from "next/navigation";
import { getPrimarySeriesSlug } from "@/lib/works";

export default async function WorksIndexPage() {
  const slug = await getPrimarySeriesSlug();
  redirect(`/works/${slug}`);
}
