import { redirect } from "next/navigation";

interface EpisodePageProps {
  params: Promise<{ number: string }>;
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { number } = await params;
  redirect(`/works/episode/${number}`);
}
