import type { Metadata } from "next";
import { ClubShell } from "./_components";
import { TheClubIntroMessage } from "./TheClubIntroMessage";
import { TheClubAccessSection } from "./TheClubAccessSection";
import { getClubAccess, canAccessClub } from "@/lib/club/access";
import { getClubStats } from "@/lib/club/catalog";

export const metadata: Metadata = {
  title: "The Club",
  description: "WHATIF EP - The Club member area",
};

export default async function TheClubPage() {
  const access = await getClubAccess();
  const stats = await getClubStats();
  const premium = canAccessClub(access);

  return (
    <ClubShell
      eyebrow="Members only"
      title="The Club"
      description={<TheClubIntroMessage />}
    >
      <TheClubAccessSection
        status={access.status}
        premium={premium}
        displayName={access.displayName}
        stats={stats}
      />
    </ClubShell>
  );
}
